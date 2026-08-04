import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";
import { isAssigned } from "@/lib/permissions";

// GET /api/missions/[key]/instructions            -> liste des versions
// GET /api/missions/[key]/instructions?version=2   -> contenu d'une version
export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const { key } = await params;

  const detail = await n8nRead({ action: "mission_detail", mission_key: key }).catch(() => null);
  if (!detail || !detail.mission) return NextResponse.json({ ok: false, error: "mission_not_found" }, { status: 404 });
  if (!isAssigned(session, detail.mission.agent_id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const version = req.nextUrl.searchParams.get("version");
  try {
    if (version) {
      const data = await n8nRead({ action: "mission_instructions", mission_key: key, version: Number(version) });
      return NextResponse.json({ ok: true, instructions: data });
    }
    const data = await n8nRead({ action: "mission_instructions_versions", mission_key: key });
    return NextResponse.json({ ok: true, versions: data.versions || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
