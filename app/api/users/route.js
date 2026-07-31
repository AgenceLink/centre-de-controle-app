import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { n8nAuth } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/scrypt";
import { parsePermissions, PERMISSION_FIELDS } from "@/lib/permissions";

const VALID_ROLES = ["admin", "operateur", "lecteur"];
const VALID_STATUSES = ["active", "disabled"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const data = await n8nAuth({ action: "list_users" });
    if (!data?.ok) return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
    const users = (data.users || []).map((u) => ({ ...u, agent_permissions: parsePermissions(u.agent_permissions) }));
    return NextResponse.json({ ok: true, users });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}

function sanitizePermissions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};
  for (const [agentId, perms] of Object.entries(input)) {
    if (!agentId || typeof agentId !== "string") continue;
    const cleaned = {};
    for (const f of PERMISSION_FIELDS) cleaned[f] = perms && perms[f] === true;
    out[agentId] = cleaned;
  }
  return out;
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (body.role && !VALID_ROLES.includes(body.role)) return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
  if (body.status && !VALID_STATUSES.includes(body.status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });

  const isSelf = email === session.email;
  if (isSelf && body.role && body.role !== "admin") {
    return NextResponse.json({ ok: false, error: "cannot_demote_self" }, { status: 400 });
  }
  if (isSelf && body.status === "disabled") {
    return NextResponse.json({ ok: false, error: "cannot_disable_self" }, { status: 400 });
  }

  const payload = { action: "upsert_user", email };
  if (body.name != null && String(body.name).trim()) payload.name = String(body.name).trim();
  if (body.role) payload.role = body.role;
  if (body.status) payload.status = body.status;
  if (body.agent_permissions !== undefined) {
    const cleaned = sanitizePermissions(body.agent_permissions);
    if (cleaned === null) return NextResponse.json({ ok: false, error: "invalid_agent_permissions" }, { status: 400 });
    payload.agent_permissions = JSON.stringify(cleaned);
  }

  if (body.createNew) {
    if (!payload.name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    if (!payload.role) payload.role = "lecteur";
  }

  let tempPassword = null;
  if (body.createNew || body.resetPassword) {
    tempPassword = crypto.randomBytes(9).toString("base64url");
    payload.password_hash = hashPassword(tempPassword);
  }

  try {
    const data = await n8nAuth(payload);
    if (!data?.ok) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 502 });
    return NextResponse.json({
      ok: true,
      email: data.email,
      role: data.role,
      status: data.status,
      agent_permissions: parsePermissions(data.agent_permissions),
      created: data.created,
      tempPassword,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}

export async function DELETE(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  if (email === session.email) {
    return NextResponse.json({ ok: false, error: "cannot_delete_self" }, { status: 400 });
  }

  try {
    const data = await n8nAuth({ action: "delete_user", email });
    if (!data?.ok) return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
    return NextResponse.json({ ok: true, email: data.email, deleted: data.deleted });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
