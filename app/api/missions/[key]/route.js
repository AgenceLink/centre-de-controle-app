import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned, viewerAgentPermissions } from "@/lib/permissions";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { key } = await params;
  try {
    const data = await n8nRead({ action: "mission_detail", mission_key: key });
    if (!data.mission) return NextResponse.json({ ok: false, error: "mission_not_found" }, { status: 404 });
    if (!isAssigned(session, data.mission.agent_id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    return NextResponse.json({
      ok: true,
      mission: data.mission,
      viewer: {
        name: session.name,
        role: session.role,
        email: session.email,
        permissions: viewerAgentPermissions(session, data.mission.agent_id),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
