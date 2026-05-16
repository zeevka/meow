import { notFound, redirect } from "next/navigation";

import { ListClient } from "@/components/lists/list-client";
import { SetupNotice } from "@/components/setup-notice";
import { fetchListPayloadBySlug, joinListBySlug } from "@/lib/data/lists";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?next=/lists/${shareSlug}`);
  }

  try {
    await joinListBySlug(supabase, shareSlug);
  } catch {
    // Ignore here and let the read path decide if the user has access.
  }

  let payload;

  try {
    payload = await fetchListPayloadBySlug(
      supabase,
      {
        id: user.id,
        email: user.email ?? null,
      },
      shareSlug,
    );
  } catch {
    notFound();
  }

  return <ListClient initialData={payload} />;
}
