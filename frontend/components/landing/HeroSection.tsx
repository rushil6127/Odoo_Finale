"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  Trophy, 
  Flame,
  ChevronDown,
  Activity,
  Award,
  Users,
  Star
} from "lucide-react";

export default function HeroSection() {
  const [selectedSport, setSelectedSport] = useState("tennis");
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = window.innerHeight;
      const progress = Math.min(1, Math.max(0, scrollY / height));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sports = [
    { id: "tennis", name: "Lawn Tennis", count: "14 Courts", icon: "🎾" },
    { id: "badminton", name: "Badminton", count: "6 Arenas", icon: "🏸" },
    { id: "padel", name: "Padel", count: "4 Courts", icon: "🎾" },
    { id: "squash", name: "Squash", count: "4 Courts", icon: "🎯" },
    { id: "swimming", name: "Olympic Pool", count: "Heated 50m", icon: "🏊‍♂️" },
  ];

  return (
    <section id="hero" className="relative pt-28 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 overflow-hidden hero-gradient-bg">
      {/* Decorative Monumental Background Glows */}
      <div 
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-sky-300/40 via-lime-200/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10 transition-transform duration-300"
        style={{ transform: `translate(-50%, ${scrollProgress * 40}px) scale(${1 - scrollProgress * 0.1})` }}
      />
      <div 
        className="absolute -top-24 -right-24 w-[420px] h-[420px] bg-sky-400/25 rounded-full blur-3xl pointer-events-none -z-10" 
        style={{ transform: `translateY(${scrollProgress * 60}px)` }}
      />
      <div 
        className="absolute top-1/4 -left-24 w-[380px] h-[380px] bg-lime-400/20 rounded-full blur-3xl pointer-events-none -z-10" 
        style={{ transform: `translateY(${scrollProgress * 80}px)` }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Status & Live Availability Capsule */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/95 border border-sky-200/90 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Live Club Status: <span className="text-green-600 font-bold">8 Courts Available</span> for Booking Today
            </span>
            <span className="hidden sm:inline-block text-[11px] text-slate-300">|</span>
            <span className="hidden sm:inline-flex items-center text-[11px] font-semibold text-sky-700">
              <Clock className="w-3 h-3 mr-1" /> 6:00 AM – 11:00 PM
            </span>
          </div>
        </div>

        {/* Central Attraction Hero Content */}
        <div className="text-center max-w-5xl mx-auto">
          {/* Elite Sports Resort Crest Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-50 via-lime-50 to-sky-50 text-sky-800 text-xs font-extrabold uppercase tracking-widest mb-6 border border-sky-200 shadow-sm">
            <Trophy className="w-4 h-4 text-sky-600" />
            <span>Gujarat&apos;s Premier Multi-Sport Sanctuary</span>
            <Star className="w-3.5 h-3.5 fill-[#CCFF00] text-sky-700" />
          </div>

          {/* MONUMENTAL CENTRAL ATTRACTION TITLE */}
          <div className="relative mb-6">
            {/* Soft Ambient Text Glow */}
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-sky-400/20 via-blue-500/20 to-lime-300/20 -z-10" />

            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-slate-900 leading-[0.95] drop-shadow-sm select-none">
              <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-500 uppercase mb-1">
                The
              </span>
              <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-sky-800 bg-clip-text text-transparent">
                Champions
              </span>{" "}
              <span className="text-slate-900 relative inline-block">
                Club
                {/* Vibrant Tennis Ball Lime Accent Dot */}
                <span className="absolute -top-1 sm:-top-2 -right-3 sm:-right-5 w-3 sm:w-5 h-3 sm:h-5 rounded-full bg-[#CCFF00] border-2 border-slate-900 shadow-sm inline-block" />
              </span>
            </h1>
          </div>

          {/* Value proposition tagline */}
          <p className="text-base sm:text-xl md:text-2xl text-slate-600 font-medium max-w-3xl mx-auto mb-10 leading-relaxed">
            Where world-class tennis on <span className="font-bold text-slate-900 underline decoration-sky-400 decoration-2 underline-offset-4">Wimbledon grass</span>, Roland-Garros clay, and Olympic aquatic arenas meet seamless digital club operations.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              href="#courts"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-sm font-extrabold text-white bg-gradient-to-r from-sky-500 via-sky-600 to-blue-700 hover:from-sky-600 hover:to-blue-800 shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-sky-300/40"
            >
              <Calendar className="w-4 h-4 text-[#CCFF00]" />
              <span>Reserve a Court Slot</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="#memberships"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-sm font-extrabold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <span>Explore Memberships</span>
              <span className="text-xs bg-lime-100 text-lime-900 px-2.5 py-0.5 rounded-full font-extrabold border border-lime-300">
                Gold &bull; Silver
              </span>
            </Link>
          </div>
        </div>

        {/* Clean, Decongested Quick-Booking & Sport Finder Card */}
        <div 
          className="glass-card rounded-3xl p-6 sm:p-8 shadow-2xl border border-sky-100/90 max-w-3xl mx-auto backdrop-blur-xl relative transition-all duration-500 text-center"
          style={{
            transform: `translateY(${scrollProgress * -20}px)`,
          }}
        >
          {/* Card Title & Tagline */}
          <div className="mb-6">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 inline-flex items-center justify-center gap-2">
              <Activity className="w-5 h-5 text-sky-600" />
              <span>Instant Court Availability & Booking</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Select your sport below to view live available slots &bull; 60-min sessions &bull; Conflict-free guaranteed
            </p>
          </div>

          {/* Centered Sport Selectors */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            {sports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                  selectedSport === sport.id
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25 scale-105"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{sport.icon}</span>
                <span>{sport.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  selectedSport === sport.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {sport.count}
                </span>
              </button>
            ))}
          </div>

          {/* Centered Booking Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="#courts"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-blue-700 hover:from-sky-600 hover:to-blue-800 text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Find & Book Available Slots</span>
              <ArrowRight className="w-4 h-4 text-[#CCFF00]" />
            </Link>
          </div>
        </div>

        {/* Club Highlights Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto mt-12">
          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-600">22+</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">Championship Courts</div>
            <div className="text-[11px] text-slate-500">Grass, Clay & Hard Surfaces</div>
          </div>

          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-green-600">1,400+</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">Active Members</div>
            <div className="text-[11px] text-slate-500">Gold, Silver & Junior Tiers</div>
          </div>

          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">6:00 AM – 11 PM</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">Daily Operating Hours</div>
            <div className="text-[11px] text-slate-500">Tournament-grade Floodlights</div>
          </div>

          <div className="bg-white/80 rounded-2xl p-4 border border-slate-200/80 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-lime-600">100%</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">Digital Operations</div>
            <div className="text-[11px] text-slate-500">Unified POS, Tab & Bookings</div>
          </div>
        </div>
      </div>
    </section>
  );
}
