"use client";

import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1E4B33]/5 via-[#FFFBF8] to-[#133C73]/5">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1E4B33] shadow-lg shadow-[#1E4B33]/20 mb-4">
            <span className="text-2xl font-bold tracking-tight text-[#CEF852]">CC</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Champions Club</h1>
          <p className="text-sm text-[#5A5A5A] mt-1">
            Sports Club Management System
          </p>
        </div>

        {/* Login Card */}
        <Card padding="lg" className="shadow-xl shadow-black/[0.04] border-[#E5E5E5]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">Sign In</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              Enter your credentials to access your account
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@championsclub.com"
              autoComplete="email"
              required
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <div className="flex justify-end mt-1.5">
                <a
                  href="#"
                  className="text-xs text-[#1E4B33] hover:underline font-medium"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E5E5E5] text-center">
            <p className="text-xs text-[#5A5A5A]">
              Demo access?{" "}
              <Link
                href="/dashboard"
                className="font-semibold text-[#1E4B33] hover:underline"
              >
                Go to Dashboard &rarr;
              </Link>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-[#9A9A9A] mt-8">
          &copy; {new Date().getFullYear()} Champions Club. All rights reserved.
        </p>
      </div>
    </div>
  );
}
