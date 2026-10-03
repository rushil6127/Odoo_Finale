"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "./Login.css";

interface ActiveViewProps {
  activeView: "login" | "register";
}

interface HeroPanelProps {
  type: "login" | "register";
  activeView: "login" | "register";
  title: string;
  text: string;
  buttonText: string;
  onToggle: () => void;
}

const CardBackground = ({ activeView }: ActiveViewProps) => (
  <div
    className={`card-bg ${activeView === "login" ? "login" : ""}`}
  />
);

const SocialButtons = () => (
  <div className="sso">
    <button type="button" aria-label="Sign in with Facebook" title="Facebook">
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    </button>
    <button type="button" aria-label="Sign in with Twitter" title="Twitter">
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </button>
    <button type="button" aria-label="Sign in with LinkedIn" title="LinkedIn">
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    </button>
  </div>
);

const HeroPanel = ({
  type,
  activeView,
  title,
  text,
  buttonText,
  onToggle,
}: HeroPanelProps) => (
  <div className={`hero ${type} ${activeView === type ? "active" : ""}`}>
    <h2>{title}</h2>
    <p>{text}</p>
    <button type="button" onClick={onToggle}>
      {buttonText}
    </button>
  </div>
);

const RegisterForm = ({ activeView }: ActiveViewProps) => (
  <div
    className={`form register ${activeView === "register" ? "active" : ""}`}
  >
    <h2>Sign Up</h2>
    <SocialButtons />
    <p className="subtitle">Or use your email address</p>
    <form onSubmit={(e) => e.preventDefault()}>
      <input type="text" placeholder="Full name" required />
      <input type="email" placeholder="Email address" required />
      <input type="password" placeholder="Password" required />
      <button type="submit">SIGN UP</button>
    </form>
  </div>
);

const LoginForm = ({ activeView }: ActiveViewProps) => (
  <div
    className={`form login ${activeView === "login" ? "active" : ""}`}
  >
    <h2>Login</h2>
    <SocialButtons />
    <p className="subtitle">Or use your email address</p>
    <form onSubmit={(e) => e.preventDefault()}>
      <input type="text" placeholder="Email" required />
      <input type="password" placeholder="Password" required />
      <a href="#" className="forgot-password">
        Forgot password?
      </a>
      <button type="submit">LOGIN</button>
    </form>
  </div>
);

export default function LoginPage() {
  const [activeView, setActiveView] = useState<"login" | "register">("login");

  const toggleView = () =>
    setActiveView((prev) => (prev === "login" ? "register" : "login"));

  return (
    <div className="auth-page-container">
      {/* Decorative Brand Header & Back Button */}
      <div className="w-full max-w-[720px] mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to The Champions Club</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-[11px] font-black text-[#CCFF00] shadow-sm">
            CC
          </div>
          <span className="text-xs font-extrabold text-slate-800">
            The Champions Club
          </span>
        </div>
      </div>

      {/* Animated Dual Panel Card */}
      <div className="card">
        <CardBackground activeView={activeView} />
        <HeroPanel
          type="register"
          activeView={activeView}
          title="Welcome back"
          text="Login to review your court bookings, active membership, and club tabs."
          buttonText="LOGIN"
          onToggle={toggleView}
        />
        <RegisterForm activeView={activeView} />
        <HeroPanel
          type="login"
          activeView={activeView}
          title="Hello there"
          text="Begin your journey with Gujarat's premier sports & country club sanctuary."
          buttonText="SIGN UP"
          onToggle={toggleView}
        />
        <LoginForm activeView={activeView} />
      </div>

      {/* Demo Links Footer */}
      <div className="mt-8 text-center text-xs text-slate-500 space-y-1.5">
        <p>
          Exploring demo staff dashboard?{" "}
          <Link
            href="/dashboard"
            className="font-bold text-sky-600 hover:underline"
          >
            Go to Admin Dashboard &rarr;
          </Link>
        </p>
        <p className="text-[11px] text-slate-400">
          &copy; {new Date().getFullYear()} The Champions Club. All rights reserved.
        </p>
      </div>
    </div>
  );
}
