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
  Users
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
    <section id="hero" className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden hero-gradient-bg">
      {/* Decorative Floating Blobs with Scroll Responsive Parallax */}
      <div 
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-sky-200/50 via-lime-200/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10 transition-transform duration-300"
        style={{ transform: `translate(-50%, ${scrollProgress * 40}px) scale(${1 - scrollProgress * 0.1})` }}
      />
      <div 
        className="absolute -top-20 -right-20 w-96 h-96 bg-sky-300/30 rounded-full blur-3xl pointer-events-none -z-10" 
        style={{ transform: `translateY(${scrollProgress * 60}px)` }}
      />
      <div 
        className="absolute top-1/3 -left-20 w-80 h-80 bg-lime-300/30 rounded-full blur-3xl pointer-events-none -z-10" 
        style={{ transform: `translateY(${scrollProgress * 80}px)` }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Live Availability Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 border border-sky-200 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Live Club Status: <span className="text-green-600 font-bold">8 Courts Available</span> for Booking Today
            </span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400">|</span>
            <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-sky-700">
              <Clock className="w-3 h-3 mr-1" /> 6:00 AM – 11:00 PM
            </span>
          </div>
        </div>

        {/* Main Hero Header Content */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Subtitle tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-4 border border-sky-200/80">
            <Trophy className="w-3.5 h-3.5 text-sky-600" />
            <span>State of the Art Sports Sanctuary</span>
          </div>

          {/* Primary Name of the Club */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            The{" "}
            <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 bg-clip-text text-transparent">
              Champions
            </span>{" "}
            Club
          </h1>

          {/* Value proposition text */}
          <p className="text-lg sm:text-xl text-slate-600 font-normal max-w-2xl mx-auto mb-8 leading-relaxed">
            Elevate your game across <span className="font-semibold text-slate-900">Grand Slam grass lawns</span>, Roland-Garros clay, Olympic aquatic arenas, and modern digital booking operations.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-12">
            <Link
              href="#courts"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Calendar className="w-4 h-4 text-[#CCFF00]" />
              <span>Reserve a Court Slot</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="#memberships"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Explore Memberships</span>
              <span className="text-xs bg-lime-100 text-lime-800 px-2 py-0.5 rounded-full font-extrabold border border-lime-300">
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
