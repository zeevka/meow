"use client";

import { Loader2, Mail, ShoppingBasket } from "lucide-react";
import { useState } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { copy, getDirection, type AppLocale } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

type AuthPanelProps = {
  locale: AppLocale;
  nextPath?: string;
};

export function AuthPanel({ locale, nextPath = "/" }: AuthPanelProps) {
  const t = copy[locale];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      return;
    }

    try {
      setPending("email");
      setMessage(null);

      const redirectUrl = new URL("/auth/callback", getSiteUrl());
      redirectUrl.searchParams.set("next", nextPath);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        throw error;
      }

      setMessage(t.emailSent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setPending(null);
    }
  }

  async function handleGoogle() {
    if (!hasSupabaseEnv()) {
      return;
    }

    try {
      setPending("google");
      setMessage(null);

      const redirectUrl = new URL("/auth/callback", getSiteUrl());
      redirectUrl.searchParams.set("next", nextPath);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in");
      setPending(null);
    }
  }

  return (
    <section
      dir={getDirection(locale)}
      className="paper-panel relative overflow-hidden p-8 sm:p-10"
    >
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-tomato/45 to-transparent" />
      <div className="flex items-center gap-3 text-olive">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-olive/12">
          <ShoppingBasket className="h-5 w-5" />
        </div>
        <div>
          <p className="eyebrow">{t.appName}</p>
          <p className="text-sm text-ink/60">{t.tagline}</p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h1 className="display-title text-4xl sm:text-5xl">{t.signInTitle}</h1>
        <p className="max-w-xl text-base leading-8 text-ink/72">{t.signInBody}</p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={handleMagicLink}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink/72">{t.emailLabel}</span>
          <div className="flex items-center gap-3 rounded-[24px] border border-olive/18 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(62,76,44,0.08)]">
            <Mail className="h-4 w-4 text-olive/60" />
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/34"
            />
          </div>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={!hasSupabaseEnv() || pending !== null}
            className="btn-primary"
          >
            {pending === "email" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t.magicLink}
          </button>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={!hasSupabaseEnv() || pending !== null}
            className="btn-secondary"
          >
            {pending === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t.google}
          </button>
        </div>

        {message ? (
          <p className="rounded-[20px] border border-olive/12 bg-olive/8 px-4 py-3 text-sm text-olive">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

