"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { useTRPC } from "@/lib/trpc/client";
import { useContent } from "@/components/site/content-context";

function GoogleButton({ next }: { next: string }) {
  const label = useContent().login.google;
  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-ink/15 bg-paper font-bold text-ink transition-colors hover:border-royal"
    >
      <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

function LoginForm() {
  const copy = useContent().login;
  const trpc = useTRPC();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("next") ?? "/account";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");

  const request = useMutation(trpc.auth.requestOtp.mutationOptions({ onSuccess: () => setStep("code") }));
  const verify = useMutation(
    trpc.auth.verifyOtp.mutationOptions({
      onSuccess: (r) => {
        router.replace(r.role === "admin" && next === "/account" ? "/admin" : next);
        router.refresh();
      },
    }),
  );
  const config = useQuery(trpc.checkout.config.queryOptions());
  const error = (step === "email" ? request.error : verify.error)?.message ?? (step === "email" ? params.get("error") : null);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[length:var(--text-display-s)]">{step === "email" ? copy.title : "Check your email"}</h1>
      <p className="mt-3 text-ink-soft">
        {step === "email" ? (
          copy.lede
        ) : (
          <>
            We sent a code to <b className="text-ink">{email}</b>. It expires in 10 minutes.
          </>
        )}
      </p>
      {step === "email" && config.data?.google && (
        <div className="mt-8">
          <GoogleButton next={next} />
          <div className="my-6 flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}
      {step === "email" ? (
        <form
          className={config.data?.google ? "space-y-4" : "mt-8 space-y-4"}
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate({ email });
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@example.com" aria-invalid={!!error} />
          </div>
          {error && <p className="text-sm font-normal text-gulal">{error}</p>}
          <Button size="lg" className="w-full" disabled={request.isPending}>
            {request.isPending && <Spinner />} {copy.emailCta}
          </Button>
        </form>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate({ email, code });
          }}
        >
          <div>
            <label className="label" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="field text-center text-2xl tracking-[0.5em]"
              aria-invalid={!!error}
            />
          </div>
          {request.data?.devHint && <p className="rounded-lg bg-haldi-soft px-3 py-2 text-sm">Dev mode: if the email doesn’t arrive, the code is also printed in the server terminal.</p>}
          {error && <p className="text-sm font-normal text-gulal">{error}</p>}
          <Button size="lg" className="w-full" disabled={verify.isPending || code.length !== 6}>
            {verify.isPending && <Spinner />} Log in
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="font-bold text-ink-soft hover:text-royal" onClick={() => setStep("email")}>
              Use another email
            </button>
            <button type="button" className="font-bold text-royal disabled:opacity-40" disabled={request.isPending} onClick={() => request.mutate({ email })}>
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-[70vh] md:grid-cols-2">
      <div className="on-dark hidden md:flex md:items-center md:justify-center md:p-12">
        <div className="arch-frame w-full max-w-[320px]">
          <div className="arch aspect-[4/5] bg-[url('/brand/hero-temple.jpg')] bg-cover bg-[50%_60%]" role="img" aria-label="Temple by a lotus pond" />
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
