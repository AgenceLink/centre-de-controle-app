import { NextResponse } from "next/server";
import { n8nAuth } from "@/lib/n8n";
import { hashPassword, verifyPassword } from "@/lib/scrypt";
import { getSession, setSessionCookie } from "@/lib/session";
import { parsePermissions } from "@/lib/permissions";

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    const { current, newPassword } = await req.json();
    if (!current || !newPassword || String(newPassword).length < 10) {
      return NextResponse.json({ ok: false, error: "weak_password", hint: "10 caractères minimum" }, { status: 400 });
    }
    const lookup = await n8nAuth({ action: "login_lookup", email: session.email });
    const user = lookup?.found ? lookup.user : null;
    if (!user || !verifyPassword(current, user.password_hash)) {
      return NextResponse.json({ ok: false, error: "invalid_current_password" }, { status: 401 });
    }
    const result = await n8nAuth({ action: "set_password", email: session.email, password_hash: hashPassword(newPassword) });
    if (!result?.ok) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    await setSessionCookie({ email: user.email, name: user.name, role: user.role, mcp: false, agent_permissions: parsePermissions(user.agent_permissions) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
