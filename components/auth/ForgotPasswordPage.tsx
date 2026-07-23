"use client";

import {
  resetPasswordAction,
  sendForgotPasswordOtpAction,
  verifyForgotPasswordOtpAction,
} from "@/app/actions/auth";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AuthShell from "./AuthShell";

const fieldClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#20304b] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter the email address on your account.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await sendForgotPasswordOtpAction(normalizedEmail);
    setBusy(false);
    if (!result.success) {
      setError(result.message || "Unable to send a reset code.");
      return;
    }
    setEmail(normalizedEmail);
    setNotice("A password reset code was sent to your email.");
    setStep(2);
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter the reset code.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await verifyForgotPasswordOtpAction(email, otp.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.message || "The reset code is invalid.");
      return;
    }
    setNotice("");
    setStep(3);
  };

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await resetPasswordAction(email, password);
    setBusy(false);
    if (!result.success) {
      setError(result.message || "Unable to reset the password.");
      return;
    }
    setStep(4);
  };

  return (
    <AuthShell
      title={step === 4 ? "Password updated" : "Reset your password"}
      description={
        step === 4
          ? "Your administrator password has been changed."
          : "We will verify your email before accepting a new password."
      }
      sideTitle="Restore access without compromising account security."
      sideDescription="A verified reset code is required before any administrator password can be replaced."
    >
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-cyan-100 bg-cyan-50 px-3.5 py-3 text-sm font-medium text-cyan-900"
        >
          {notice}
        </p>
      ) : null}

      {step === 1 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendOtp();
          }}
          className="space-y-5"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Account email
            </span>
            <span className="relative block">
              <Mail
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="name@company.com"
                className={`${fieldClass} pl-10`}
                required
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00aeb5] text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:opacity-60"
          >
            {busy ? "Sending code…" : "Send reset code"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyOtp();
          }}
          className="space-y-5"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Reset code sent to {email}
            </span>
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter the code"
              className={`${fieldClass} text-center text-lg tracking-[0.3em]`}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00aeb5] text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Verify reset code"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendOtp()}
            className="w-full text-center text-sm font-bold text-[#009ca4] disabled:opacity-60"
          >
            Resend code
          </button>
        </form>
      ) : null}

      {step === 3 ? (
        <form onSubmit={resetPassword} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              New password
            </span>
            <span className="relative block">
              <KeyRound
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                className={`${fieldClass} pl-10`}
                required
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              className={fieldClass}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00aeb5] text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:opacity-60"
          >
            {busy ? "Updating password…" : "Update password"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : null}

      {step === 4 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-emerald-600"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-semibold leading-6 text-emerald-900">
            Use the new password the next time you sign in.
          </p>
          <Link
            href="/sign-in"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white hover:bg-[#009ca4]"
          >
            Return to sign in
          </Link>
        </div>
      ) : null}

      {step < 4 ? (
        <Link
          href="/sign-in"
          className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#009ca4]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      ) : null}
    </AuthShell>
  );
}
