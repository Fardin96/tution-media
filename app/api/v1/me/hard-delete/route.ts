import { NextRequest, NextResponse } from "next/server";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export async function DELETE(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  if (!auth) {
    return NextResponse.json(
      { message: "Your session has expired. Sign in again." },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/me/hard-delete`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: auth,
      },
    });

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
    };
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: "Couldn't reach the account service. Try again in a moment." },
      { status: 502 },
    );
  }
}
