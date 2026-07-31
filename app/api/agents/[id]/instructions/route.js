import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

// GET /api/agents/[id]/instructions            -> liste des versions
// GET /api/agents/[id]/instructions?version=2   -> contenu d'une version
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  if (!isAssigned(session, id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const version = req.nextUrl.searchParams.get("version");
  try {
    if (version) {
      const data = await n8nRead({ action: "instructions", agent_id: id, version: Number(version) });
      return NextResponse.json({ ok: true, instructions: data });
    }
    const data = await n8nRead({ action: "instructions_versions", agent_id: id });
    return NextResponse.json({ ok: true, versions: data.versions || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
