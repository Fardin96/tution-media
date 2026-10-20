import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=NoCode", request.url));
  }

  const appUrl = process.env.NEXT_APP_URL;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_SECRET;

  if (!appUrl || !clientId || !clientSecret) {
    console.error("OAuth callback missing env vars", {
      appUrlSet: !!appUrl,
      clientIdSet: !!clientId,
      clientSecretSet: !!clientSecret,
    });
    return NextResponse.redirect(
      new URL("/sign-in?error=ConfigError", request.url),
    );
  }

  const redirectUri = `${appUrl}/api/auth/callback/google`;
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    if (!tokens.id_token) {
      throw new Error("Missing id_token");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid token payload");

    const userSession = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, JSON.stringify(userSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("OAuth Exchange Error:", err);
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=AuthFailed&message=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
