import { NextResponse } from "next/server";
import { n8nRead } from "@/lib/n8n";
import { getSession } from "@/lib/session";

// GET /api/agents/[id]/run-events?run_id=xxx
export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const runId = req.nextUrl.searchParams.get("run_id");
  if (!runId) return NextResponse.json({ ok: false, error: "run_id_required" }, { status: 400 });
  try {
    const data = await n8nRead({ action: "run_events", run_id: runId });
    return NextResponse.json({ ok: true, events: data.events || [] });
  } catch {
    return NextResponse.json({ ok: false, error: "registry_unreachable" }, { status: 502 });
  }
}
