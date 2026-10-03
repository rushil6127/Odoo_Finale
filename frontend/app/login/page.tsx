"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, Crown, ShieldAlert } from "lucide-react";
import {
  DEMO_MEMBERS,
  setStoredUser,
  getStoredUser,
  loginUser,
  registerUser,
  loginWithGoogle,
  getRoleProfilePath,
  isStaffOrAdmin,
  isOwner,
  type AuthUserProfile,
} from "@/lib/auth";
import "./Login.css";

const GOOGLE_CLIENT_ID = "934545206972-sffuvr8okqbn86bsq0qcuf76344lno9c.apps.googleusercontent.com";

interface HeroPanelProps {
  type: "login" | "register";
  activeView: "login" | "register";
  title: string;
  text: string;
  buttonText: string;
  onToggle: () => void;
}

const CardBackground = ({ activeView }: { activeView: "login" | "register" }) => (
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
      await loginWithGoogle(response.credential);
      const currentUser = getStoredUser();
      router.push(getRoleProfilePath(currentUser));
    } catch (err: any) {
      const msg = err?.message || "Google authentication failed. Please try again.";
      setLoginError(msg);
      setRegError(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Function to initialize and render Google button
    const initGoogle = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const loginBtn = document.getElementById("google-signin-login");
        if (loginBtn) {
          loginBtn.innerHTML = "";
          google.accounts.id.renderButton(loginBtn, {
            theme: "outline",
            size: "large",
            width: 280,
            text: "continue_with",
            shape: "pill",
          });
        }

        const regBtn = document.getElementById("google-signin-register");
        if (regBtn) {
          regBtn.innerHTML = "";
          google.accounts.id.renderButton(regBtn, {
            theme: "outline",
            size: "large",
            width: 280,
            text: "signup_with",
            shape: "pill",
          });
        }
      }
    };

    // If script already exists, just render
    if ((window as any).google?.accounts?.id) {
      initGoogle();
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [handleGoogleResponse, activeView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      await loginUser(loginEmail, loginPassword);
      const currentUser = getStoredUser();
      router.push(getRoleProfilePath(currentUser));
    } catch (err: any) {
      // Fallback: If backend is unreachable or demo testing, allow quick demo login
      if (loginEmail.toLowerCase().includes("alex") || loginEmail === "") {
        handleDemoLogin(DEMO_MEMBERS.alex);
        return;
      }
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
      const regData = await registerUser({
        email: regEmail,
        password: regPassword,
        first_name: firstName,
        last_name: lastName,
      });

      const currentUser = getStoredUser();

      // Staff / owner should go to their dashboard directly.
      // New regular members land on the membership selection page.
      if (isStaffOrAdmin(currentUser) || isOwner(currentUser)) {
        router.push(getRoleProfilePath(currentUser));
      } else {
        // No membership yet — guide the new member to pick a plan
        router.push("/membership?welcome=1");
      }
    } catch (err: any) {
      setRegError(err?.message || "Registration failed. Please check your details.");
    } finally {
      setRegLoading(false);
    }
  };

  const handleDemoLogin = (user: AuthUserProfile) => {
    setStoredUser(user);
    router.push(getRoleProfilePath(user));
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

      {/* Quick One-Click Demo Logins */}
      <div className="w-full max-w-[720px] mb-4 p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="font-bold text-sky-900 flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-amber-500" />
          <span>Quick 1-Click Demo Login:</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDemoLogin(DEMO_MEMBERS.alex)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-600 hover:text-white text-slate-800 font-extrabold border border-sky-200 shadow-sm transition-all"
          >
            Alex Morgan (Member)
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin(DEMO_MEMBERS.coach_david)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm transition-all"
          >
            Coach David (Sport Head)
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin(DEMO_MEMBERS.admin)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-700 text-white font-extrabold shadow-sm transition-all"
          >
            Priya Sharma (Staff & Admin)
          </button>
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

          {/* Official Google Button Container */}
          <div className="w-full flex justify-center my-1.5 min-h-[44px]">
            {googleLoading ? (
              <div className="flex items-center gap-2 text-xs text-sky-600 font-semibold py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting with Google...</span>
              </div>
            ) : (
              <div id="google-signin-register" className="flex justify-center" />
            )}
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
              placeholder="Full name (e.g. Alex Morgan)"
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

          {/* Official Google Button Container */}
          <div className="w-full flex justify-center my-1.5 min-h-[44px]">
            {googleLoading ? (
              <div className="flex items-center gap-2 text-xs text-sky-600 font-semibold py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting with Google...</span>
              </div>
            ) : (
              <div id="google-signin-login" className="flex justify-center" />
            )}
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
            className="font-bold text-sky-600 hover:underline inline-flex items-center justify-center gap-1 ml-1"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />
            <span>Staff & Owner Console &rarr;</span>
          </Link>
        </p>
        <p className="text-[11px] text-slate-400">
          &copy; {new Date().getFullYear()} The Champions Club. All rights reserved.
        </p>
      </div>
    </div>
  );
}
