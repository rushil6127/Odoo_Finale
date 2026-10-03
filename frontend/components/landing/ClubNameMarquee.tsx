"use client";

import { Trophy, Sparkles, Star, Zap } from "lucide-react";

export default function ClubNameMarquee() {
  const marqueeItems = [
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🎾 WIMBLEDON GRASS LAWNS", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🏆 22+ GRAND SLAM COURTS", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "⚡ 100% CONNECTED OPERATIONS", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🏊 OLYMPIC HEATED AQUATICS", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🏸 MAPLE WOOD BADMINTON", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🏅 ROLAND-GARROS RED CLAY", highlight: false },
    { text: "THE CHAMPIONS CLUB", highlight: true },
    { text: "🎾 PANORAMIC GLASS PADEL", highlight: false },
  ];

  return (
    <div className="relative py-4 sm:py-5 bg-slate-900 border-y border-slate-800 overflow-hidden shadow-inner select-none">
      {/* Subtle Glow Overlays */}
      <div className="absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent z-10 pointer-events-none" />

      {/* Continuous Marquee Track */}
      <div className="flex animate-marquee whitespace-nowrap">
        {/* Set 1 */}
        <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-6 sm:pr-10">
          {marqueeItems.map((item, idx) => (
            <div key={`set1-${idx}`} className="flex items-center gap-6 sm:gap-10">
              {item.highlight ? (
                <span className="font-black text-sm sm:text-base tracking-widest font-[family-name:var(--font-outfit)] bg-gradient-to-r from-sky-400 via-sky-200 to-lime-300 bg-clip-text text-transparent flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-[#CCFF00] text-[#CCFF00] inline-block" />
                  <span>{item.text}</span>
                </span>
              ) : (
                <span className="font-bold text-xs sm:text-sm tracking-wider text-slate-400 uppercase flex items-center gap-2">
                  <span>{item.text}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Set 2 (Exact duplicate for seamless infinite loop) */}
        <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-6 sm:pr-10" aria-hidden="true">
          {marqueeItems.map((item, idx) => (
            <div key={`set2-${idx}`} className="flex items-center gap-6 sm:gap-10">
              {item.highlight ? (
                <span className="font-black text-sm sm:text-base tracking-widest font-[family-name:var(--font-outfit)] bg-gradient-to-r from-sky-400 via-sky-200 to-lime-300 bg-clip-text text-transparent flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-[#CCFF00] text-[#CCFF00] inline-block" />
                  <span>{item.text}</span>
                </span>
              ) : (
                <span className="font-bold text-xs sm:text-sm tracking-wider text-slate-400 uppercase flex items-center gap-2">
                  <span>{item.text}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
