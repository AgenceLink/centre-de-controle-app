import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    const data = await n8nRead({ action: "audit_log", agent_id: id, limit: 100 });
    return NextResponse.json({ ok: true, entries: data.entries || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
