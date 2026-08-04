import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  // les missions n'existent que pour zizou pour l'instant ; le filtre par agent
  // suivra naturellement quand d'autres agents auront des missions.
  if (!isAssigned(session, "zizou")) return NextResponse.json({ ok: true, missions: [], viewer: { name: session.name, role: session.role, email: session.email } });
  try {
    const data = await n8nRead({ action: "missions_list", agent_id: "zizou" });
    return NextResponse.json({ ok: true, missions: data.missions || [], viewer: { name: session.name, role: session.role, email: session.email } });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
