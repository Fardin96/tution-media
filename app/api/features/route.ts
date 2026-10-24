import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/features";

export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json({ features: flags });
}
