"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Check,
  X
} from "lucide-react";

interface CourtFacility {
  id: string;
  name: string;
  count: number;
  sport: string;
  surface: string;
  image: string;
  tag: string;
  price: string;
  memberPerk: string;
  lighting: string;
  pace: string;
  status: "Available" | "Limited Slots";
  details: string[];
}

const courtFacilities: CourtFacility[] = [
  {
    id: "grass-tennis",
    name: "Centre Lawn Grass Courts",
    count: 4,
    sport: "Tennis",
    surface: "Natural Ryegrass (Wimbledon Spec)",
    image: "https://i.pinimg.com/1200x/00/40/d3/0040d3c46aec9fee98ea2c53a128987a.jpg",
    tag: "Grass Surface",
    price: "₹800 / hr",
    memberPerk: "Complimentary (Gold & Silver)",
    lighting: "1000 Lux Tournament LED",
    pace: "Fast Pace / Low Bounce",
    status: "Available",
    details: [
      "Precision cut 8mm turf with automatic subsurface drainage",
      "Player rest pavilions with hydration stations",
      "Friday Social-Play session support"
    ],
  },
  {
    id: "box-cricket",
    name: "Championship Box Cricket Arena",
    count: 2,
    sport: "Cricket",
    surface: "High-Density Astro Turf & Safety Netting",
    image: "https://i.pinimg.com/736x/f5/17/a3/f517a3ffa906881c9e045697c70489a9.jpg",
    tag: "Floodlit Box Cricket",
    price: "₹1,200 / hr",
    memberPerk: "20% Discount for Members",
    lighting: "1000 Lux Day-Night Floodlights",
    pace: "Fast & True Turf Pitch",
    status: "Available",
    details: [
      "Fully enclosed netting with automated bowling machine",
      "Premium leather & hard tennis ball match facilities",
      "Dugout player seating & electronic live scoreboard"
    ],
  },
  {
    id: "table-tennis",
    name: "Pro Table Tennis Arena",
    count: 6,
    sport: "Table Tennis",
    surface: "ITTF-Approved Blue Tournament Tables",
    image: "https://i.pinimg.com/736x/7a/46/81/7a468188b71faa96159529f85536cbe7.jpg",
    tag: "Olympic TT Lounge",
    price: "₹350 / hr",
    memberPerk: "Free for All Members",
    lighting: "Glare-Free Anti-Shadow LED",
    pace: "High-Speed Spin Response",
    status: "Available",
    details: [
      "6x ITTF-certified competition tables on sprung wooden floor",
      "Programmable multi-ball robotic feeder for solo drills",
      "Air-conditioned sports lounge with premium paddles"
    ],
  },
  {
    id: "badminton-arena",
    name: "Indoor Badminton",
    count: 6,
    sport: "Badminton",
    surface: "Canadian Maple Sprung Wood",
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
    tag: "Climate Controlled",
    price: "₹450 / hr",
    memberPerk: "Free for All Members",
    lighting: "600 Lux Glare-Free LED",
    pace: "Pro Response Traction",
    status: "Available",
    details: [
      "Fully air-conditioned 24°C environment",
      "BWF-certified anti-slip tournament mats",
      "Adjacent racket stringing station"
    ],
  },
  {
    id: "padel-courts",
    name: "Pro Panoramic Padel Arena",
    count: 4,
    sport: "Padel",
    surface: "Mondo Supercourt XN Turf & Panoramic Glass",
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    tag: "WPT Spec Padel",
    price: "₹900 / hr",
    memberPerk: "₹200 / hr for Members",
    lighting: "Anti-Glare Column LED (800 Lux)",
    pace: "Fast Agility & Spin",
    status: "Limited Slots",
    details: [
      "12mm seamless panoramic tempered glass with zero frame obstruction",
      "Integrated electronic scorekeeper and match video replay",
      "Complimentary carbon-fiber padel rackets and balls"
    ],
  },
  {
    id: "aquatics-pool",
    name: "Olympic Size Swimming Pool",
    count: 1,
    sport: "Swimming",
    surface: "Heated 8-Lane Pool (27°C)",
    image: "https://i.pinimg.com/736x/63/74/f4/6374f4ed45c4478aa1e4708e3f2be181.jpg ",
    tag: "Aquatics Pavilion",
    price: "₹400 / day",
    memberPerk: "Unlimited Access (Gold/Silver)",
    lighting: "Submersible Underwater LED",
    pace: "FINA Lap Standard",
    status: "Available",
    details: [
      "Ozone-purified water heated at 27°C",
      "Certified lifeguards on duty continuously",
      "Steam, sauna, and hot jacuzzi recovery suites"
    ],
  },
];

export default function CourtsShowcase() {
  const [filterSport, setFilterSport] = useState("all");
  const [selectedCourt, setSelectedCourt] = useState<CourtFacility | null>(null);

  const filteredCourts = filterSport === "all"
    ? courtFacilities
    : courtFacilities.filter(c => c.sport.toLowerCase().includes(filterSport.toLowerCase()));

  return (
    <section id="courts" className="py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3 border border-sky-200">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>22+ Total Playing Venues</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
            Championship Courts & Arenas
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-xl mx-auto">
            Select an arena to view real-time open slots and reserve your 60-minute match session.
          </p>

          {/* Minimal Filter Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-6">
            {[
              { id: "all", label: "All Arenas (22+)" },
              { id: "tennis", label: "🎾 Tennis" },
              { id: "badminton", label: "🏸 Badminton & Squash" },
              { id: "padel", label: "🎾 Padel" },
              { id: "swimming", label: "🏊‍♂️ Swimming Pool" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterSport(btn.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${filterSport === btn.id
                  ? "bg-slate-900 text-white shadow-md scale-105"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Minimal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCourts.map((court) => (
            <div
              key={court.id}
              onClick={() => setSelectedCourt(court)}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col cursor-pointer"
            >
              {/* Card Photo Header */}
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <Image
                  src={court.image}
                  alt={court.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-[11px] font-bold shadow-sm border border-white">
                    {court.count} {court.count === 1 ? "Arena" : "Courts"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/75 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {court.status}
                  </span>
                </div>

                {/* Surface Tag Bottom Left */}
                <div className="absolute bottom-3 left-4">
                  <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                    {court.tag}
                  </span>
                </div>
              </div>

              {/* Minimal Card Content */}
              <div className="p-5 sm:p-6 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors font-[family-name:var(--font-outfit)] mb-1">
                    {court.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-1">
                    {court.surface}
                  </p>

                  {/* Clean Spec Pills */}
                  <div className="flex items-center gap-2 flex-wrap mb-5">
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                      ⚡ {court.lighting}
                    </span>
                    <span className="text-[11px] font-semibold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg">
                      🎾 {court.pace}
                    </span>
                  </div>
                </div>

                {/* Price & Action Row */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                      Starting From
                    </span>
                    <span className="text-base font-extrabold text-slate-900">
                      {court.price}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 group-hover:bg-sky-600 transition-colors shadow-sm">
                    <span>Book Court</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clean Modal for Court Details & Booking */}
        {selectedCourt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
              {/* Modal Photo */}
              <div className="relative aspect-[16/9] w-full bg-slate-900">
                <Image
                  src={selectedCourt.image}
                  alt={selectedCourt.name}
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => setSelectedCourt(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 rounded-full bg-sky-500 text-white text-xs font-bold">
                    {selectedCourt.tag}
                  </span>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <h3 className="text-2xl font-extrabold text-slate-900 mb-1 font-[family-name:var(--font-outfit)]">
                  {selectedCourt.name}
                </h3>
                <p className="text-xs text-slate-500 mb-4">{selectedCourt.surface}</p>

                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 mb-5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Member Privilege:</span>
                    <span className="font-bold text-sky-700">{selectedCourt.memberPerk}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Walk-in Rate:</span>
                    <span className="font-bold text-slate-900">{selectedCourt.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Floodlights:</span>
                    <span className="font-semibold text-slate-800">{selectedCourt.lighting}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {selectedCourt.details.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/login"
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-md shadow-sky-500/20"
                  >
                    Sign In & Reserve Slot
                  </Link>
                  <button
                    onClick={() => setSelectedCourt(null)}
                    className="py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
