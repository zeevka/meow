import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SetupNotice } from "@/components/setup-notice";
import { fetchDashboardPayload } from "@/lib/data/dashboard";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="page-shell">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-8 sm:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6 px-1">
              <p className="eyebrow">Pantry Paper</p>
              <h1 className="display-title max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
                Grocery lists that feel quick, shared, and human.
              </h1>
              <p className="max-w-2xl text-lg leading-9 text-ink/70">
                Make as many lists as you want, share each one with a link, and
                watch updates appear across devices as soon as someone checks,
                edits, restores, or deletes an item.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="paper-panel p-5">
                  <p className="section-title">Realtime lists</p>
                  <p className="mt-2 text-sm leading-7 text-ink/66">
                    Every change syncs across phones, tablets, and desktops.
                  </p>
                </div>
                <div className="paper-panel p-5">
                  <p className="section-title">Smart archive</p>
                  <p className="mt-2 text-sm leading-7 text-ink/66">
                    Bought items become quick suggestions the next time you type.
                  </p>
                </div>
                <div className="paper-panel p-5">
                  <p className="section-title">Offline warmth</p>
                  <p className="mt-2 text-sm leading-7 text-ink/66">
                    Recent lists stay cached locally and pending edits replay on reconnect.
                  </p>
                </div>
              </div>
            </section>

            <AuthPanel locale="en" nextPath={params.next ?? "/"} />
          </div>
        </div>
      </main>
    );
  }

  const payload = await fetchDashboardPayload(supabase, {
    id: user.id,
    email: user.email ?? null,
  });

  if (params.next) {
    redirect(params.next);
  }

  return <DashboardClient initialData={payload} />;
}
