import { notFound, redirect } from "next/navigation";

import { ListClient } from "@/components/lists/list-client";
import { fetchListForSession } from "@/lib/custom-auth";
import { getSessionToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    shareSlug: string;
  }>;
};

export default async function ListPage({ params }: PageProps) {
  const { shareSlug } = await params;
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    redirect(`/?next=/lists/${shareSlug}`);
  }

  let payload;

  try {
    payload = await fetchListForSession(shareSlug);
  } catch {
    notFound();
  }

  if (!payload) {
    redirect(`/?next=/lists/${shareSlug}`);
  }

  return <ListClient initialData={payload} />;
}
