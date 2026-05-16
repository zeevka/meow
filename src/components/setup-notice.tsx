import { copy, getDirection, type AppLocale } from "@/lib/i18n";

export function SetupNotice({ locale = "en" }: { locale?: AppLocale }) {
  const t = copy[locale];

  return (
    <div dir={getDirection(locale)} className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="paper-panel w-full space-y-5 p-8 sm:p-10">
        <p className="eyebrow">{t.appName}</p>
        <h1 className="display-title text-4xl">{t.setupTitle}</h1>
        <p className="max-w-2xl text-base leading-8 text-ink/72">{t.setupBody}</p>
        <div className="rounded-[28px] border border-olive/20 bg-paper/70 p-5 text-sm text-ink/74">
          <p className="font-medium text-ink">Required env vars</p>
          <ul className="mt-3 space-y-2 font-mono text-xs text-ink/70">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
            <li>NEXT_PUBLIC_SITE_URL</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
