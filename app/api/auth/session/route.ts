import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;

  const session = {
    id: String(body.id ?? ""),
    email: String(body.email ?? ""),
    name: String(body.name ?? ""),
    role: String(body.role ?? "STUDENT"),
    picture: body.picture ? String(body.picture) : undefined,
    status: body.status ? String(body.status) : undefined,
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
