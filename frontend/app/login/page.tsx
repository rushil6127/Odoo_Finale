"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { loginUser, registerUser, loginWithGoogle } from "@/lib/auth";
import "./Login.css";

const GOOGLE_CLIENT_ID = "934545206972-sffuvr8okqbn86bsq0qcuf76344lno9c.apps.googleusercontent.com";

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
  <div className={`card-bg ${activeView === "login" ? "login" : ""}`} />
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

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"login" | "register">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Google OAuth Loading
  const [googleLoading, setGoogleLoading] = useState(false);

  const toggleView = () => {
    setLoginError(null);
    setRegError(null);
    setActiveView((prev) => (prev === "login" ? "register" : "login"));
  };

  const handleGoogleResponse = useCallback(async (response: any) => {
    if (!response?.credential) return;
    setGoogleLoading(true);
    setLoginError(null);
    setRegError(null);

    try {
      const data = await loginWithGoogle(response.credential);
      const user = data.user;
      if (user?.role === "MEMBER") {
        router.push("/");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.message || "Google authentication failed. Please try again.";
      setLoginError(msg);
      setRegError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Load Google Identity Services library
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [handleGoogleResponse]);

  const handleCustomGoogleClick = () => {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const data = await loginUser(loginEmail, loginPassword);
      const user = data.user;
      
      if (user?.role === "MEMBER") {
        router.push("/");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Invalid email or password. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    const nameParts = regFullName.trim().split(" ");
    const firstName = nameParts[0] || "Member";
    const lastName = nameParts.slice(1).join(" ") || "User";

    try {
      await registerUser({
        email: regEmail,
        password: regPassword,
        first_name: firstName,
        last_name: lastName,
      });

      router.push("/");
    } catch (err: any) {
      setRegError(err?.message || "Registration failed. Please check your details.");
    } finally {
      setRegLoading(false);
    }
  };

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
        
        {/* Left Side: Hero for Register View */}
        <HeroPanel
          type="register"
          activeView={activeView}
          title="Welcome back"
          text="Login to review your court bookings, active membership, and club tabs."
          buttonText="LOGIN"
          onToggle={toggleView}
        />

        {/* Register Form */}
        <div className={`form register ${activeView === "register" ? "active" : ""}`}>
          <h2>Sign Up</h2>

          {/* Google SSO Button */}
          <div className="w-full my-1">
            <button
              type="button"
              onClick={handleCustomGoogleClick}
              disabled={googleLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2.5"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="subtitle">or register with email</p>

          {regError && (
            <div className="w-full mb-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{regError}</span>
            </div>
          )}

          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Full name (e.g. Rushil Patel)"
              value={regFullName}
              onChange={(e) => setRegFullName(e.target.value)}
              required
              disabled={regLoading || googleLoading}
            />
            <input
              type="email"
              placeholder="Email address"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              disabled={regLoading || googleLoading}
            />
            <input
              type="password"
              placeholder="Password (min. 6 characters)"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
              minLength={6}
              disabled={regLoading || googleLoading}
            />
            <button type="submit" disabled={regLoading || googleLoading} className="flex items-center justify-center gap-2">
              {regLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>CREATING ACCOUNT...</span>
                </>
              ) : (
                <span>SIGN UP</span>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Hero for Login View */}
        <HeroPanel
          type="login"
          activeView={activeView}
          title="Hello there"
          text="Begin your journey with Gujarat's premier sports & country club sanctuary."
          buttonText="SIGN UP"
          onToggle={toggleView}
        />

        {/* Login Form */}
        <div className={`form login ${activeView === "login" ? "active" : ""}`}>
          <h2>Login</h2>

          {/* Google SSO Button */}
          <div className="w-full my-1">
            <button
              type="button"
              onClick={handleCustomGoogleClick}
              disabled={googleLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2.5"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="subtitle">or login with email</p>

          {loginError && (
            <div className="w-full mb-2 p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email address"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              disabled={loginLoading || googleLoading}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              disabled={loginLoading || googleLoading}
            />
            <button type="submit" disabled={loginLoading || googleLoading} className="flex items-center justify-center gap-2">
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>LOGGING IN...</span>
                </>
              ) : (
                <span>LOGIN</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Demo Links Footer */}
      <div className="mt-8 text-center text-xs text-slate-500 space-y-1.5">
        <p>
          Staff or management personnel?{" "}
          <Link
            href="/dashboard"
            className="font-bold text-sky-600 hover:underline"
          >
            Staff & Owner Console &rarr;
          </Link>
        </p>
        <p className="text-[11px] text-slate-400">
          &copy; {new Date().getFullYear()} The Champions Club. All rights reserved.
        </p>
      </div>
    </div>
  );
}
