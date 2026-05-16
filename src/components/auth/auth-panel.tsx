"use client";

import { ArrowLeft, Loader2, LockKeyhole, Mail, ShoppingBasket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { apiJson } from "@/lib/http";
import { copy, getDirection, type AppLocale } from "@/lib/i18n";

type AuthPanelProps = {
  locale: AppLocale;
  nextPath?: string;
  initialMessage?: string | null;
};

export function AuthPanel({
  locale,
  nextPath = "/",
  initialMessage = null,
}: AuthPanelProps) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<AppLocale>(locale);
  const t = copy[activeLocale];
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [step, setStep] = useState<"email" | "signin" | "signup">("email");
  const [pending, setPending] = useState<
    "lookup" | "password" | "signup" | null
  >(null);

  async function handleEmailLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      return;
    }

    try {
      setPending("lookup");
      setMessage(null);

      const result = await apiJson<{
        account_exists: boolean;
        password_account: boolean;
      }>("/api/auth/check-email", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (result?.account_exists && result?.password_account) {
        setStep("signin");
        setMessage(t.existingAccount);
        return;
      }

      if (result?.account_exists && !result?.password_account) {
        setStep("signup");
        setMessage(t.noPasswordAccount);
        return;
      }

      setStep("signup");
      setMessage(t.newAccount);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check account");
    } finally {
      setPending(null);
    }
  }

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      return;
    }

    try {
      setPending("password");
      setMessage(null);

      await apiJson("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setPending(null);
    }
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      return;
    }

    try {
      setPending("signup");
      setMessage(null);

      await apiJson("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({
          email,
          firstName,
          password,
          locale: activeLocale,
        }),
      });

      router.push(nextPath);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create account",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      dir={getDirection(activeLocale)}
      className="paper-panel relative w-full overflow-hidden p-8 sm:p-10"
    >
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-tomato/45 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 text-olive">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-olive/12">
            <ShoppingBasket className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow">{t.appName}</p>
            <p className="text-sm text-ink/60">{t.tagline}</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-ghost min-w-[5.5rem] justify-center"
          onClick={() =>
            setActiveLocale((current) => (current === "he" ? "en" : "he"))
          }
        >
          {activeLocale === "he" ? "EN" : "עב"}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        <h1 className="display-title text-4xl sm:text-5xl">{t.signInTitle}</h1>
        <p className="max-w-xl text-base leading-8 text-ink/72">{t.signInBody}</p>
      </div>

      {step === "email" ? (
        <form className="mt-8 space-y-4" onSubmit={handleEmailLookup}>
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
                dir="ltr"
                className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/34"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={!hasSupabaseEnv() || pending !== null}
            className="btn-primary"
          >
            {pending === "lookup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t.continue}
          </button>

          {message ? (
            <p className="rounded-[20px] border border-olive/12 bg-olive/8 px-4 py-3 text-sm text-olive">
              {message}
            </p>
          ) : null}
        </form>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={step === "signin" ? handlePasswordSignIn : handleCreateAccount}
        >
          <div className="rounded-[24px] border border-olive/18 bg-white/70 px-4 py-3 text-sm text-ink/72 shadow-[0_12px_30px_rgba(62,76,44,0.08)]">
            {email}
          </div>

          {step === "signup" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink/72">{t.firstNameLabel}</span>
              <div className="flex items-center gap-3 rounded-[24px] border border-olive/18 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(62,76,44,0.08)]">
                <Mail className="h-4 w-4 text-olive/60" />
                <input
                  required
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={activeLocale === "he" ? "דנה" : "Dana"}
                  className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/34"
                />
              </div>
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink/72">{t.passwordLabel}</span>
            <div className="flex items-center gap-3 rounded-[24px] border border-olive/18 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(62,76,44,0.08)]">
              <LockKeyhole className="h-4 w-4 text-olive/60" />
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={6}
                dir="ltr"
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
              {pending === "password" || pending === "signup" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {step === "signin" ? t.passwordSignIn : t.createAccount}
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setStep("email");
                setFirstName("");
                setPassword("");
                setMessage(null);
              }}
              className="btn-ghost"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </button>
          </div>

          {message ? (
            <p className="rounded-[20px] border border-olive/12 bg-olive/8 px-4 py-3 text-sm text-olive">
              {message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
