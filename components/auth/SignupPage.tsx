"use client";

import {
  sendSignupOtpAction,
  signUpAction,
  verifySignupOtpAction,
} from "@/app/actions/auth";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AuthShell from "./AuthShell";

const fieldClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#20304b] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10";

const StepBadge = ({
  number,
  active,
  complete,
}: {
  number: number;
  active: boolean;
  complete: boolean;
}) => (
  <span
    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
      complete
        ? "bg-emerald-100 text-emerald-700"
        : active
          ? "bg-[#eaf9f8] text-[#008f96]"
          : "bg-slate-100 text-slate-400"
    }`}
  >
    {complete ? <CheckCircle2 className="h-4 w-4" /> : number}
  </span>
);

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const result = await sendSignupOtpAction(normalizedEmail);
    setBusy(false);
    if (!result.success) {
      setError(result.message || "Unable to send the verification code.");
      return;
    }
    setEmail(normalizedEmail);
    setNotice("A verification code was sent to your email.");
    setStep(2);
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter the verification code.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await verifySignupOtpAction(email, otp.trim());
    setBusy(false);
    if (!result.success) {
      setError(result.message || "The verification code is invalid.");
      return;
    }
    setNotice("");
    setStep(3);
  };

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
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
    const result = await signUpAction({
      name: name.trim(),
      email,
      phone: phone.trim() || undefined,
      password,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.message || "Unable to create the account.");
      return;
    }
    setStep(4);
  };

  return (
    <AuthShell
      title={step === 4 ? "Account created" : "Create an account"}
      description={
        step === 4
          ? "Your DXG administrator account is ready."
          : "Verify your email and set up your administrator profile."
      }
      sideTitle="Create governed access for the DXG workspace."
      sideDescription="Email verification protects new accounts before profile and password details are accepted."
    >
      {step < 4 ? (
        <div className="mb-7 flex items-center gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex flex-1 items-center gap-2">
              <StepBadge
                number={item}
                active={step === item}
                complete={step > item}
              />
              {item < 3 ? (
                <span
                  className={`h-px flex-1 ${
                    step > item ? "bg-emerald-200" : "bg-slate-200"
                  }`}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

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
              Work email address
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
            {busy ? "Sending code…" : "Continue with email"}
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
          <div>
            <p className="text-sm font-semibold text-[#20304b]">{email}</p>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp("");
                setError("");
                setNotice("");
              }}
              className="mt-1 text-xs font-bold text-[#009ca4]"
            >
              Change email
            </button>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Verification code
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
            {busy ? "Verifying…" : "Verify email"}
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
        <form onSubmit={createAccount} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Full name
            </span>
            <span className="relative block">
              <UserRound
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your full name"
                className={`${fieldClass} pl-10`}
                required
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">
              Phone number <span className="font-normal">(optional)</span>
            </span>
            <span className="relative block">
              <Phone
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                placeholder="Your phone number"
                className={`${fieldClass} pl-10`}
              />
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-600">
                Password
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
                Confirm password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat password"
                className={fieldClass}
                required
              />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setError("");
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#00aeb5] text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create account"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : null}

      {step === 4 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-emerald-600"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-semibold leading-6 text-emerald-900">
            Your email is verified and the account has been created.
          </p>
          <Link
            href="/sign-in"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white hover:bg-[#009ca4]"
          >
            Continue to sign in
          </Link>
        </div>
      ) : null}

      {step < 4 ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-bold text-[#009ca4] hover:text-[#007e85]"
          >
            Sign in
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
