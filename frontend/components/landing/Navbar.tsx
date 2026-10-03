"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Menu, 
  X, 
  Calendar, 
  User, 
  Crown,
  ChevronDown
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";

interface NavLink {
  name: string;
  href: string;
}

const navLinks: NavLink[] = [
  { name: "Home", href: "#hero" },
  { name: "Courts", href: "#courts" },
  { name: "Memberships", href: "#memberships" },
  { name: "Facilities", href: "#facilities" },
  { name: "Gallery", href: "#gallery" },
  { name: "Pro Shop", href: "#shop" },
  { name: "Café", href: "#cafe" },
  { name: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [activeSection, setActiveSection] = useState("Home");
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      // Simple active section detection
      const sections = navLinks.map((link) => link.href.substring(1));
      const current = sections.find((section) => {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          return rect.top <= 120 && rect.bottom >= 120;
        }
        return false;
      });

      if (current) {
        const found = navLinks.find((l) => l.href === `#${current}`);
        if (found) setActiveSection(found.name);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 pt-3 sm:pt-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          {/* Floating Pill Container Inspired by user reference / isaitnu */}
          <nav
            className={`pill-navbar-glass pill-navbar-shadow rounded-full px-3.5 sm:px-6 py-2.5 sm:py-3 transition-all duration-300 flex items-center justify-between ${
              isScrolled ? "py-2 sm:py-2.5 bg-white/95 shadow-lg border-sky-100" : ""
            }`}
          >
            {/* Brand Emblem & Name */}
            <Link href="#hero" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-sm sm:text-base tracking-wider shadow-md shadow-sky-500/25 border-2 border-white group-hover:scale-105 transition-transform duration-200">
                <span className="text-[#CCFF00] drop-shadow-sm font-extrabold">CC</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm sm:text-[15px] tracking-tight text-slate-900 leading-none group-hover:text-sky-600 transition-colors">
                  The Champions Club
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-sky-600 uppercase mt-0.5">
                  ELITE SPORTS & COUNTRY RESORT
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links Pill Container */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/60 shadow-inner">
              {navLinks.map((link) => {
                const isActive = activeSection === link.name;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setActiveSection(link.name)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white text-sky-700 font-semibold shadow-sm border border-slate-200/80"
                        : "text-slate-600 hover:text-sky-600 hover:bg-white/50"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* Right Action CTA Buttons: Profile or Sign In */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              {isAuthenticated && user ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 p-1.5 pr-3.5 rounded-full bg-slate-100/90 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 shadow-sm transition-all group"
                  title="Open Member Profile & Digital Portal"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-blue-700 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-extrabold text-slate-900 group-hover:text-sky-700 leading-tight">
                      {user.name.split(" ")[0]}
                    </span>
                    <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5 uppercase tracking-tight">
                      <Crown className="w-2.5 h-2.5 text-amber-500 inline" />
                      {user.membershipPlan}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-y-0.5" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-sky-600 px-3.5 py-2 rounded-full transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  <span>Sign In</span>
                </Link>
              )}

              <Link
                href="#courts"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 px-4 py-2 rounded-full shadow-md shadow-sky-500/20 hover:shadow-sky-500/35 transition-all duration-200 active:scale-95 border border-sky-400/30"
              >
                <Calendar className="w-3.5 h-3.5 text-[#CCFF00]" />
                <span>Book Court</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full text-slate-700 hover:bg-slate-100 lg:hidden focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
            </button>
          </nav>
        </div>

        {/* Mobile Drawer Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 mx-auto max-w-7xl px-2">
            <div className="glass-card rounded-3xl p-4 shadow-xl border border-sky-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="grid grid-cols-2 gap-1.5 pb-3 border-b border-slate-100">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => {
                      setActiveSection(link.name);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      activeSection === link.name
                        ? "bg-sky-50 text-sky-700 font-semibold border border-sky-200"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {isAuthenticated && user ? (
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-sky-50 border border-sky-200 text-slate-900"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                        {user.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-extrabold text-slate-900">{user.name}</div>
                        <div className="text-[10px] text-sky-700 font-bold">{user.membershipPlan} Member &bull; Open Full Portal</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-sky-600">Open &rarr;</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
                  >
                    <User className="w-4 h-4 text-sky-600" />
                    <span>Member Portal Login</span>
                  </Link>
                )}

                <Link
                  href="#courts"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-500/20"
                >
                  <Calendar className="w-4 h-4 text-[#CCFF00]" />
                  <span>Book Court Now</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
