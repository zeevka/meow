import { notFound, redirect } from "next/navigation";

import { ListClient } from "@/components/lists/list-client";
import { SetupNotice } from "@/components/setup-notice";
import { fetchListForSession } from "@/lib/custom-auth";
import { hasSupabaseEnv } from "@/lib/env";
import { isSupabaseSchemaSetupError } from "@/lib/supabase/errors";
import { getSessionToken } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    shareSlug: string;
  }>;
};

export default async function ListPage({ params }: PageProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const { shareSlug } = await params;
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    redirect(`/?next=/lists/${shareSlug}`);
  }

  let payload;

  try {
    payload = await fetchListForSession(shareSlug);
  } catch (error) {
    if (isSupabaseSchemaSetupError(error)) {
      return <SetupNotice mode="database" />;
    }

    notFound();
  }

  if (!payload) {
    redirect(`/?next=/lists/${shareSlug}`);
  }

  return <ListClient initialData={payload} />;
}
