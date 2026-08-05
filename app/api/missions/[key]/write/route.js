import { NextResponse } from "next/server";
import { n8nRead, n8nWrite } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned, canDo } from "@/lib/permissions";

const ALLOWED_ACTIONS = ["edit_mission_instructions", "set_current_mission_version", "set_mission_schedule", "set_mission_run_now"];

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (session.role === "lecteur") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { key } = await params;

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }
  const { action, ...rest } = body || {};
  if (!ALLOWED_ACTIONS.includes(action)) return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });

  const detail = await n8nRead({ action: "mission_detail", mission_key: key }).catch(() => null);
  if (!detail || !detail.mission) return NextResponse.json({ ok: false, error: "mission_not_found" }, { status: 404 });
  if (!isAssigned(session, detail.mission.agent_id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!canDo(session, detail.mission.agent_id, action)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  try {
    const data = await n8nWrite({ ...rest, action, mission_key: key, actor: session.email });
    if (!data.ok) return NextResponse.json(data, { status: 422 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
