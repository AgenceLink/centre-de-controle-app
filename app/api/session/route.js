import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ ok: true, viewer: { name: session.name, email: session.email, role: session.role } });
}
