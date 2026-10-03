"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Check, 
  ArrowRight,
  Info,
  SlidersHorizontal
} from "lucide-react";

interface CourtFacility {
  id: string;
  name: string;
  count: number;
  sport: string;
  surface: string;
  lighting: string;
  speed: string;
  memberPrice: string;
  guestPrice: string;
  status: "Available" | "Limited Slots" | "Prime Active";
  features: string[];
  badgeColor: string;
}

const courtFacilities: CourtFacility[] = [
  {
    id: "grass-tennis",
    name: "Centre Lawn Grass Courts",
    count: 4,
    sport: "Tennis",
    surface: "Natural Perennial Ryegrass (Wimbledon Spec)",
    lighting: "1000 Lux LED Tournament Lighting",
    speed: "Fast / Low Bounce",
    memberPrice: "Complimentary (Gold/Silver)",
    guestPrice: "₹800 / hour",
    status: "Available",
    features: [
      "Precision cut 8mm grass height",
      "Automatic subsurface drainage system",
      "Player rest pavilions with hydration stations",
      "Friday Social-Play session support"
    ],
    badgeColor: "bg-lime-100 text-lime-800 border-lime-300",
  },
  {
    id: "clay-tennis",
    name: "French Roland-Garros Clay Courts",
    count: 4,
    sport: "Tennis",
    surface: "Crushed Red Brick & Limestone Foundation",
    lighting: "800 Lux Night Match Floodlights",
    speed: "Slow / High Spin Bounce",
    memberPrice: "Complimentary (Gold) / ₹250 (Silver)",
    guestPrice: "₹750 / hour",
    status: "Available",
    features: [
      "Authentic sliding surface for joint protection",
      "Automated misting and leveling system",
      "Individual umpire chairs & electronic scoreboard",
      "Complimentary line sweepers available"
    ],
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    id: "hard-tennis",
    name: "US Open Acrylic Hard Courts",
    count: 6,
    sport: "Tennis",
    surface: "9-Layer Cushioned DecoTurf Acrylic",
    lighting: "1200 Lux Broadcast Specification",
    speed: "Medium-Fast / True Bounce",
    memberPrice: "Complimentary for All Members",
    guestPrice: "₹600 / hour",
    status: "Available",
    features: [
      "Shock-absorbing rubberized base mat",
      "All-weather non-slip tournament coating",
      "Video analysis camera mounts on Courts 1 & 2",
      "Available for early morning (6 AM) bookings"
    ],
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
  },
  {
    id: "badminton-arena",
    name: "Indoor Badminton & Squash Arena",
    count: 6,
    sport: "Badminton & Squash",
    surface: "Imported Canadian Maple Wood with Sprung Base",
    lighting: "Glare-Free Indirect Diffused LED (600 Lux)",
    speed: "Pro Response / Maximum Traction",
    memberPrice: "Complimentary for Members",
    guestPrice: "₹450 / hour",
    status: "Available",
    features: [
      "Fully climate-controlled 24°C air conditioning",
      "BWF-certified anti-slip synthetic tournament mats",
      "Racket stringing station available adjacent",
      "Dedicated coaching bays & warm-up area"
    ],
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    id: "padel-courts",
    name: "Panoramic Glass Padel Courts",
    count: 4,
    sport: "Padel",
    surface: "Texturized Monofilament Turf with Silica Infill",
    lighting: "Column-Mounted Anti-Glare LED",
    speed: "Medium / High Agility",
    memberPrice: "₹200 / session (Member)",
    guestPrice: "₹900 / hour",
    status: "Limited Slots",
    features: [
      "12mm toughened structural tempered glass",
      "Integrated audio scorekeeper buttons",
      "Complimentary hire of carbon padel rackets",
      "Weekly club round-robin ladders"
    ],
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    id: "aquatics-pool",
    name: "Olympic 50M Aquatic Center",
    count: 1,
    sport: "Swimming & Hydrotherapy",
    surface: "Mosaic Ceramic Tiles / Ozone Purification",
    lighting: "Submersible Underwater & Pavilion Lighting",
    speed: "8 Lap Lanes (Fina Standard)",
    memberPrice: "Unlimited for Gold & Silver",
    guestPrice: "₹400 / day pass",
    status: "Available",
    features: [
      "Temperature regulated at optimal 27°C",
      "Certified lifeguards on duty continuously",
      "Steam, sauna, and hot jacuzzi recovery suites",
      "Aqua aerobics & master stroke clinics"
    ],
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-300",
  },
];

export default function CourtsShowcase() {
  const [filterSport, setFilterSport] = useState("all");

  const filteredCourts = filterSport === "all" 
    ? courtFacilities 
    : courtFacilities.filter(c => c.sport.toLowerCase().includes(filterSport.toLowerCase()));

  return (
    <section id="courts" className="py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3 border border-sky-200">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>22+ Total Playing Courts</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Championship Courts & Surfaces
          </h2>
          <p className="text-slate-600 text-base mt-3 leading-relaxed">
            Experience the three Grand Slam surfaces on one campus. All courts feature automated conflict-free digital scheduling, 60-minute sessions, and tournament floodlights.
          </p>

          {/* Filter Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-8">
            {[
              { id: "all", label: "All Facilities (22+)" },
              { id: "tennis", label: "🎾 Tennis (14 Courts)" },
              { id: "badminton", label: "🏸 Badminton & Squash (6 Arenas)" },
              { id: "padel", label: "🎾 Padel (4 Courts)" },
              { id: "swimming", label: "🏊‍♂️ Olympic Pool" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterSport(btn.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                  filterSport === btn.id
                    ? "bg-slate-900 text-white shadow-md scale-105"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Courts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourts.map((court) => (
            <div
              key={court.id}
              className="glass-card glass-card-hover rounded-3xl p-6 flex flex-col justify-between border border-slate-200 relative group"
            >
              <div>
                {/* Header Tag & Availability */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${court.badgeColor}`}>
                    {court.count} {court.count === 1 ? "Arena" : "Courts Available"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {court.status}
                  </span>
                </div>

                {/* Court Name */}
                <h3 className="text-xl font-extrabold text-slate-900 mb-1 group-hover:text-sky-600 transition-colors">
                  {court.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  {court.surface}
                </p>

                {/* Quick Specs List */}
                <div className="bg-slate-50/80 rounded-2xl p-3.5 space-y-2 mb-4 text-xs border border-slate-200/60">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-medium">Lighting:</span>
                    <span className="font-semibold text-slate-900">{court.lighting}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-medium">Pace / Bounce:</span>
                    <span className="font-semibold text-slate-900">{court.speed}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-medium">Member Rate:</span>
                    <span className="font-bold text-sky-700">{court.memberPrice}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-medium">Walk-in Rate:</span>
                    <span className="font-bold text-slate-800">{court.guestPrice}</span>
                  </div>
                </div>

                {/* Feature Bullet Points */}
                <div className="space-y-1.5 mb-6">
                  {court.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center text-slate-900 bg-slate-100 group-hover:bg-sky-600 group-hover:text-white transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Book This Arena</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Booking Rules Banner per docs/prd.md and docs/rules.md */}
        <div className="mt-12 bg-sky-50/80 rounded-3xl p-6 border border-sky-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Champions Club Court Reservation Policy
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                1-Hour standard play sessions &bull; Staggered 30-minute booking openings &bull; Max 2 reservations per member/day &bull; Automatic conflict-prevention system
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              href="#memberships"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 bg-white px-4 py-2 rounded-full border border-sky-200 shadow-sm"
            >
              <span>View Member Benefits</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
