import { NextResponse } from "next/server";
import { n8nWrite } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned, canDo } from "@/lib/permissions";

const ALLOWED_ACTIONS = ["set_status", "set_schedule", "run_now", "edit_instructions", "set_current_version", "acknowledge_errors"];

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role === "lecteur") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isAssigned(session, id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

  const { action, ...rest } = body || {};
  if (!ALLOWED_ACTIONS.includes(action)) return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  if (!canDo(session, id, action)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  try {
    const data = await n8nWrite({ ...rest, action, agent_id: id, actor: session.email });
    if (!data.ok) return NextResponse.json(data, { status: 422 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
