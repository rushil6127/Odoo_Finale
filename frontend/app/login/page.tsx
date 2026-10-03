"use client";

import Link from "next/link";
import { ArrowLeft, User, Lock, Sparkles, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-white to-lime-50/50 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-lime-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back to Home Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to The Champions Club</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 shadow-xl shadow-sky-500/20 border-2 border-white mb-4">
            <span className="text-2xl font-black tracking-tight text-[#CCFF00]">CC</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">The Champions Club</h1>
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider mt-1">
            MEMBER & STAFF ACCESS PORTAL
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-8 shadow-2xl border border-slate-200/80">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Sign In to Your Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Access your court bookings, membership plan, and tabs
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="member@championsclub.in"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex justify-end mt-1.5">
                <a
                  href="#"
                  className="text-xs text-sky-600 hover:underline font-semibold"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 shadow-md shadow-sky-500/20 active:scale-95 transition-all mt-2"
            >
              Sign In to Portal
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-600">
              Exploring demo staff dashboard?{" "}
              <Link
                href="/dashboard"
                className="font-bold text-sky-600 hover:underline inline-flex items-center gap-1"
              >
                <span>Go to Admin Dashboard</span> &rarr;
              </Link>
            </p>
            <p className="text-[11px] text-slate-400">
              Not a member yet?{" "}
              <Link href="/#contact" className="font-semibold text-slate-700 hover:underline">
                Apply for a Free Trial Pass
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} The Champions Club. All rights reserved.
        </p>
      </div>
    </div>
  );
}
