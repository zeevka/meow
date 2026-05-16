import { NextResponse } from "next/server";

import { fetchListForSession } from "@/lib/custom-auth";

type RouteProps = {
  params: Promise<{
    shareSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { shareSlug } = await params;
    const data = await fetchListForSession(shareSlug);

    if (!data) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load list" },
      { status: 400 },
    );
  }
}

