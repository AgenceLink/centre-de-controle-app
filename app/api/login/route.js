import { NextResponse } from "next/server";
import { n8nAuth } from "@/lib/n8n";
import { verifyPassword } from "@/lib/scrypt";
import { setSessionCookie } from "@/lib/session";
import { parsePermissions } from "@/lib/permissions";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }
    const lookup = await n8nAuth({ action: "login_lookup", email: String(email).trim().toLowerCase() });
    const user = lookup?.found ? lookup.user : null;
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }
    await setSessionCookie({
      email: user.email,
      name: user.name,
      role: user.role,
      mcp: !!user.must_change_password,
      agent_permissions: parsePermissions(user.agent_permissions),
    });
    n8nAuth({ action: "touch_login", email: user.email }).catch(() => {});
    return NextResponse.json({ ok: true, must_change_password: !!user.must_change_password, role: user.role, name: user.name });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
