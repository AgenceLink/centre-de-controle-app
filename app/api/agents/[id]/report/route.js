import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!isAssigned(session, id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const data = await n8nRead({ action: "agent_report", agent_id: id });
    if (!data.ok) return NextResponse.json({ ok: false, error: data.error || "report_unavailable" }, { status: 200 });
    return NextResponse.json({ ok: true, records: data.records || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
