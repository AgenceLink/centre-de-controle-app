import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { key } = await params;

  const detail = await n8nRead({ action: "mission_detail", mission_key: key }).catch(() => null);
  if (!detail || !detail.mission) return NextResponse.json({ ok: false, error: "mission_not_found" }, { status: 404 });
  if (!isAssigned(session, detail.mission.agent_id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  try {
    const data = await n8nRead({ action: "mission_runs", mission_key: key });
    return NextResponse.json({ ok: true, runs: data.runs || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
