"use client";

import Link from "next/link";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  Trophy, 
  Calendar, 
  ShoppingBag, 
  Coffee,
  Heart,
  ExternalLink
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-base shadow-md border-2 border-slate-700">
                <span className="text-[#CCFF00]">CC</span>
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block">
                  The Champions Club
                </span>
                <span className="text-[10px] font-bold tracking-wider text-sky-400 uppercase">
                  ELITE SPORTS & COUNTRY RESORT
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-6">
              Gujarat&apos;s premier multi-sport sanctuary featuring Grand Slam grass, French clay, and tournament acrylic courts, an Olympic aquatic pavilion, and unified digital club operations.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Operating Hours: <strong>6:00 AM – 11:00 PM</strong> (All 7 Days)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Champions Boulevard, Sports Complex Zone, Gujarat, India</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Concierge: +91 (079) 4500-CHAMP / +91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span>enquiries@championsclub.in</span>
              </div>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Club Navigation
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="#hero" className="hover:text-sky-400 transition-colors">
                  Home & Overview
                </Link>
              </li>
              <li>
                <Link href="#courts" className="hover:text-sky-400 transition-colors">
                  Courts & Arenas (22+)
                </Link>
              </li>
              <li>
                <Link href="#memberships" className="hover:text-sky-400 transition-colors">
                  Membership Plans
                </Link>
              </li>
              <li>
                <Link href="#gallery" className="hover:text-sky-400 transition-colors">
                  Campus Photo Gallery
                </Link>
              </li>
              <li>
                <Link href="#shop" className="hover:text-sky-400 transition-colors">
                  Pro Shop & Stringing
                </Link>
              </li>
              <li>
                <Link href="#cafe" className="hover:text-sky-400 transition-colors">
                  Café & Sports Lounge
                </Link>
              </li>
              <li>
                <Link href="#contact" className="hover:text-sky-400 transition-colors">
                  Book Free Trial
                </Link>
              </li>
            </ul>
          </div>

          {/* Sports & Arenas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Courts & Facilities
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center justify-between">
                <span>Centre Grass Lawns</span>
                <span className="text-[10px] text-lime-400 font-bold">4 Courts</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Floodlit Box Cricket</span>
                <span className="text-[10px] text-amber-400 font-bold">2 Arenas</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Pro Table Tennis</span>
                <span className="text-[10px] text-sky-400 font-bold">6 Tables</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Badminton Arenas</span>
                <span className="text-[10px] text-emerald-400 font-bold">6 Courts</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Volleyball Arena</span>
                <span className="text-[10px] text-blue-400 font-bold">2 Courts</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Olympic 50M Pool</span>
                <span className="text-[10px] text-cyan-400 font-bold">Heated</span>
              </li>
            </ul>
          </div>

          {/* Member Portal & Staff Access */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Digital Portal
            </h4>
            <div className="space-y-3">
              <Link
                href="/profile"
                className="block p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-200 group transition-all"
              >
                <div className="font-bold text-white group-hover:text-sky-400 flex items-center justify-between">
                  <span>Member Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Bookings, balance & tabs
                </div>
              </Link>

              <Link
                href="/dashboard"
                className="block p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-200 group transition-all"
              >
                <div className="font-bold text-white group-hover:text-lime-400 flex items-center justify-between">
                  <span>Staff & Admin Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  POS, Courts, CRM & Owner KPIs
                </div>
              </Link>

              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-900/60 text-[11px] text-sky-300">
                <strong>Booking Rule:</strong> 60-minute sessions, max 2 reservations/day per member.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} The Champions Club. All rights reserved. Built for excellence.
          </p>

          <div className="flex items-center gap-6">
            <span className="text-slate-400">Court Booking Policy</span>
            <span className="text-slate-400">Membership Terms</span>
            <span className="text-slate-400">Privacy Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
