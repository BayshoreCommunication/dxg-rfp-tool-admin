"use client";

import { signInAction } from "@/app/actions/auth";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthShell from "./AuthShell";

const inputWrapClass =
  "relative flex h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-[#00aeb5] focus-within:ring-4 focus-within:ring-cyan-500/10";

export default function SigninPage() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    const result = await signInAction(
      normalizedEmail,
      password,
      callbackUrl,
    );
    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message || "Login failed. Please try again.");
      return;
    }

    window.location.assign(result.callbackUrl || "/dashboard");
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with your administrator account to continue to the DXG workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-slate-600">
            Email address
          </span>
          <span className={inputWrapClass}>
            <Mail
              className="ml-3.5 h-4.5 w-4.5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="email"
              placeholder="name@company.com"
              className="h-full w-full bg-transparent px-3.5 text-sm font-semibold text-[#20304b] outline-none placeholder:font-normal placeholder:text-slate-400"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={submitting}
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
            Password
            <Link
              href="/forgot-password"
              className="font-semibold text-[#009ca4] hover:text-[#007e85]"
            >
              Forgot password?
            </Link>
          </span>
          <span className={inputWrapClass}>
            <KeyRound
              className="ml-3.5 h-4.5 w-4.5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="h-full w-full bg-transparent px-3.5 text-sm font-semibold text-[#20304b] outline-none placeholder:font-normal placeholder:text-slate-400"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="flex h-full w-11 shrink-0 items-center justify-center text-slate-400 transition hover:text-[#009ca4]"
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
              ) : (
                <Eye className="h-4.5 w-4.5" aria-hidden="true" />
              )}
            </button>
          </span>
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(0,174,181,0.22)] transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{submitting ? "Signing in…" : "Sign in to dashboard"}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Need an administrator account? Ask an existing super admin to create it.
      </p>
    </AuthShell>
  );
}
