import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned, viewerAgentPermissions } from "@/lib/permissions";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!isAssigned(session, id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const data = await n8nRead({ action: "agent_detail", agent_id: id });
    if (!data.agent) return NextResponse.json({ ok: false, error: "agent_not_found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      agent: data.agent,
      viewer: {
        name: session.name,
        role: session.role,
        email: session.email,
        permissions: viewerAgentPermissions(session, id),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
