import { NextResponse } from "next/server";

async function verifyToken(token, secret) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
    const expected = Buffer.from(mac).toString("base64url");
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo-link.png" ||
    pathname === "/vagues.png";
  if (isPublic) return NextResponse.next();

  const session = await verifyToken(req.cookies.get("cc_session")?.value, process.env.AUTH_SECRET || "");
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session.mcp && !pathname.startsWith("/change-password") && !pathname.startsWith("/api/password") && !pathname.startsWith("/api/logout")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "password_change_required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
