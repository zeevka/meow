import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SetupNotice } from "@/components/setup-notice";
import { fetchDashboardForSession } from "@/lib/custom-auth";
import { hasSupabaseEnv } from "@/lib/env";
import { isSupabaseSchemaSetupError } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    next?: string;
    auth_error?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const params = await searchParams;
  const payload = await fetchDashboardForSession().catch((error) => {
    if (isSupabaseSchemaSetupError(error)) {
      return "__database_error__" as const;
    }

    throw error;
  });

  if (payload === "__database_error__") {
    return <SetupNotice mode="database" />;
  }

  if (!payload) {
    return (
      <main className="page-shell">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-5 py-8 sm:px-8">
          <AuthPanel
            locale="he"
            nextPath={params.next ?? "/"}
            initialMessage={params.auth_error ?? null}
          />
        </div>
      </main>
    );
  }

  if (params.next) {
    redirect(params.next);
  }

  return <DashboardClient initialData={payload} />;
}
