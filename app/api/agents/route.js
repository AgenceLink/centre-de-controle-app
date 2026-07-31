import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  try {
    const data = await n8nRead({ action: "agents_list" });
    let agents = data.agents || [];
    if (session.role !== "admin") {
      agents = agents.filter((a) => isAssigned(session, a.agent_id));
    }
    return NextResponse.json({ ok: true, agents, viewer: { name: session.name, role: session.role, email: session.email } });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
