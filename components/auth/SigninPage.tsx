"use client";

import { signInAction } from "@/app/actions/auth";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const SigninPage = () => {
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
    const res = await signInAction(normalizedEmail, password, callbackUrl);
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || "Login failed. Please try again.");
      return;
    }

    window.location.assign(res.callbackUrl || "/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef2f7] p-4 text-[#000000]">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-amber-200/45 blur-3xl" />

      <div className="relative z-10 w-full max-w-[460px] rounded-[2.5rem] bg-white/88 px-10 py-12 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.5)] backdrop-blur-xl ring-1 ring-slate-200/40 sm:px-14 sm:py-16">
        <div className="mb-6 flex justify-center">
          <h3 className="text-primary text-2xl font-bold">Logo.</h3>
        </div>

        <h2 className="mb-3 text-center text-[32px] font-extrabold tracking-tight text-gray-900 leading-none">
          Welcome Back
        </h2>
        <p className="mb-10 text-center text-[14px] font-medium text-gray-400">
          Enter your details to access your account
        </p>

        <form onSubmit={handleSubmit} className="mb-6 space-y-4">
          <div className="mb-0 group">
            <label className="mb-2 block text-[13px] font-bold text-gray-700">
              Email Address
            </label>
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-gray-200 bg-white/70 transition-all duration-300 focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10 hover:border-gray-300">
              <div className="pl-4 pr-3 text-gray-400 group-focus-within:text-primary transition-colors">
                <Mail className="h-5 w-5" strokeWidth={2} />
              </div>
              <input
                type="email"
                placeholder="name@company.com"
                className="w-full bg-transparent py-4 pr-4 text-[15px] font-semibold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="group">
            <label className="mb-2 block text-[13px] font-bold text-gray-700">
              Password
            </label>
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-gray-200 bg-white/70 transition-all duration-300 focus-within:border-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10 hover:border-gray-300">
              <div className="pl-4 pr-3 text-gray-400 group-focus-within:text-primary transition-colors">
                <KeyRound className="h-5 w-5" strokeWidth={2} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="**********"
                className="w-full bg-transparent py-4 pr-4 text-[15px] font-semibold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="flex items-center justify-center px-4 text-gray-400 transition-colors hover:text-primary focus:outline-none disabled:opacity-60"
                disabled={submitting}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-500">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="group relative mb-2 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl bg-black py-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span>{submitting ? "Signing In..." : "Sign In to Dashboard"}</span>
            <ArrowRight
              className={`h-4 w-4 transition-transform ${submitting ? "animate-pulse" : "group-hover:translate-x-1"}`}
            />
            <div className="absolute inset-0 -translate-x-full bg-white/20 blur-md transition-transform duration-500 group-hover:translate-x-full"></div>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SigninPage;
