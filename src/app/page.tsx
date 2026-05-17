import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { fetchDashboardForSession } from "@/lib/custom-auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    next?: string;
    auth_error?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const payload = await fetchDashboardForSession();

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
