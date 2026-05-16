import { NextResponse } from "next/server";

import { fetchDashboardForSession } from "@/lib/custom-auth";

export async function GET() {
  try {
    const data = await fetchDashboardForSession();
    if (!data) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard" },
      { status: 400 },
    );
  }
}

