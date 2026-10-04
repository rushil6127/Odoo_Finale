"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  X,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Crown,
  Tag,
  ChevronDown,
  UserCheck,
  Loader2,
  Phone,
  Mail,
  User,
  RefreshCw,
  Trophy,
  Activity,
  Layers,
  Waves,
  CircleDot,
  Target,
  GraduationCap,
  Volleyball
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useCurrentUser, getStoredToken, setStoredToken, isOwner, setStoredUser } from "@/lib/auth";

interface BackendCourt {
  id: number;
  name: string;
  sport_type: string;
  surface_type?: string;
  is_indoor: boolean;
  status: string;
  is_bookable: boolean;
  custom_open_time?: string | null;
  custom_close_time?: string | null;
}

interface PricingRules {
  sport_rates: Record<string, number>;
  member_discounts: Record<string, number>;
  operating_hours: {
    open: string;
    close: string;
    slot_interval_minutes: number;
    booking_duration_minutes: number;
  };
  friday_social_play: {
    enabled: boolean;
    base_rate: number;
    start_time: string;
    end_time: string;
  };
}

interface PriceBreakdown {
  court_id: number;
  court_name: string;
  sport_type: string;
  base_price: number;
  discount_percentage: number;
  discount_amount: number;
  final_price: number;
  tier: string;
  description: string;
  is_social_play: boolean;
}

interface TimeSlot {
  slot_index: number;
  start_time: string;
  end_time: string;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  is_available: boolean;
  reason?: string | null;
}

interface CourtFacility {
  id: string;
  sportKey: string;
  name: string;
  count: number;
  sport: string;
  surface: string;
  image: string;
  tag: string;
  defaultPrice: number;
  lighting: string;
  pace: string;
  status: "Available" | "Limited Slots";
  details: string[];
}

const courtFacilities: CourtFacility[] = [
  {
    id: "grass-tennis",
    sportKey: "LAWN_TENNIS",
    name: "Centre Lawn Grass Courts",
    count: 4,
    sport: "Tennis",
    surface: "Natural Ryegrass & Clay Venues",
    image: "https://i.pinimg.com/1200x/00/40/d3/0040d3c46aec9fee98ea2c53a128987a.jpg",
    tag: "Championship Arenas",
    defaultPrice: 800,
    lighting: "1000 Lux Tournament LED",
    pace: "Fast Pace / Low Bounce",
    status: "Available",
    details: [
      "Precision cut 8mm turf with automatic subsurface drainage",
      "Player rest pavilions with hydration stations",
      "Friday Social-Play session support (18:00 – 21:00)"
    ],
  },
  {
    id: "badminton-arena",
    sportKey: "BADMINTON",
    name: "Indoor Badminton Arenas",
    count: 6,
    sport: "Badminton",
    surface: "Canadian Maple Sprung Wood & BWF PVC",
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
    tag: "Climate Controlled",
    defaultPrice: 400,
    lighting: "600 Lux Glare-Free LED",
    pace: "Pro Response Traction",
    status: "Available",
    details: [
      "Fully air-conditioned 24°C environment with 6 tournament courts",
      "BWF-certified anti-slip mats & high-contrast shuttle lighting",
      "Adjacent pro stringing & equipment checkout desk"
    ],
  },
  {
    id: "box-cricket",
    sportKey: "BOX_CRICKET",
    name: "Championship Box Cricket Arena",
    count: 2,
    sport: "Cricket",
    surface: "High-Density Astro Turf & Safety Netting",
    image: "https://i.pinimg.com/736x/f5/17/a3/f517a3ffa906881c9e045697c70489a9.jpg",
    tag: "Floodlit Box Cricket",
    defaultPrice: 1500,
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
    sportKey: "TABLE_TENNIS",
    name: "Pro Table Tennis Arena",
    count: 2,
    sport: "Table Tennis",
    surface: "ITTF-Approved Blue Tournament Tables",
    image: "https://i.pinimg.com/736x/7a/46/81/7a468188b71faa96159529f85536cbe7.jpg",
    tag: "Olympic TT Lounge",
    defaultPrice: 300,
    lighting: "Glare-Free Anti-Shadow LED",
    pace: "High-Speed Spin Response",
    status: "Available",
    details: [
      "ITTF-certified competition tables on sprung wooden floor",
      "Programmable multi-ball robotic feeder for solo drills",
      "Air-conditioned sports lounge with premium paddles"
    ],
  },
  {
    id: "volleyball-courts",
    sportKey: "VOLLEYBALL",
    name: "Beach Volleyball Sand Arena",
    count: 1,
    sport: "Volleyball",
    surface: "Fine Silica Beach Sand Pit",
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    tag: "Silica Sand Pit",
    defaultPrice: 600,
    lighting: "Anti-Glare Column LED (800 Lux)",
    pace: "Fast Agility & Shock Absorption",
    status: "Limited Slots",
    details: [
      "High-density pure silica sand for superior cushion and dive safety",
      "Integrated electronic scorekeeper and match video replay",
      "Complimentary tournament-grade volleyballs and net setup"
    ],
  },
  {
    id: "aquatics-pool",
    sportKey: "SWIMMING_POOL",
    name: "Olympic 50M Aquatic Pavilion",
    count: 1,
    sport: "Swimming",
    surface: "Heated 8-Lane Pool (27°C)",
    image: "https://i.pinimg.com/736x/63/74/f4/6374f4ed45c4478aa1e4708e3f2be181.jpg",
    tag: "Aquatics Pavilion",
    defaultPrice: 500,
    lighting: "Submersible Underwater LED",
    pace: "FINA Lap Standard",
    status: "Available",
    details: [
      "Ozone-purified water heated continuously at 27°C",
      "Certified lifeguards & coach stroke clinics on duty",
      "Steam, sauna, and hot jacuzzi recovery suites"
    ],
  },
];

function getSportIcon(sportKey: string, className = "w-4 h-4") {
  switch (sportKey) {
    case "LAWN_TENNIS":
      return <CircleDot className={className} />;
    case "BADMINTON":
      return <Activity className={className} />;
    case "BOX_CRICKET":
      return <Trophy className={className} />;
    case "TABLE_TENNIS":
      return <Layers className={className} />;
    case "SWIMMING_POOL":
      return <Waves className={className} />;
    case "VOLLEYBALL":
      return <Target className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export default function CourtsShowcase() {
  const { user, isAuthenticated } = useCurrentUser();

  // Filter state
  const [filterSport, setFilterSport] = useState("all");

  // Backend Dynamic Data State
  const [backendCourts, setBackendCourts] = useState<BackendCourt[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRules | null>(null);

  // Booking Modal State
  const [selectedFacility, setSelectedFacility] = useState<CourtFacility | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [bookingNotes, setBookingNotes] = useState<string>("");

  // Guest booking fields
  const [bookingTab, setBookingTab] = useState<"member" | "guest">("member");
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // 1. Fetch Backend Courts & Pricing Rules on mount
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [courtsRes, rulesRes] = await Promise.all([
          apiClient.get<{ courts: BackendCourt[] }>("/courts"),
          apiClient.get<PricingRules>("/bookings/pricing-rules"),
        ]);
        if (courtsRes?.courts) {
          setBackendCourts(courtsRes.courts.filter((c) => c.status === "ACTIVE"));
        }
        if (rulesRes) {
          setPricingRules(rulesRes);
        }
      } catch (err) {
        console.error("Failed to load courts or pricing rules from backend:", err);
      }
    }
    loadBackendData();
  }, []);

  // 2. Auto-heal auth token if logged-in session exists without token
  useEffect(() => {
    if (isAuthenticated && user && !getStoredToken()) {
      apiClient
        .post<{ access_token: string }>("/auth/demo-login", {
          email: user.email,
          role: user.role,
          full_name: user.name || user.full_name,
        })
        .then((res) => {
          if (res?.access_token) {
            setStoredToken(res.access_token);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, user]);

  // Determine user's effective membership tier
  const effectiveTier = useMemo(() => {
    if (!isAuthenticated || !user) return "WALK_IN";
    if (user.membershipPlan) return user.membershipPlan.toUpperCase();
    if (user.role === "MEMBER") return "GOLD";
    return "GOLD"; // Staff/Coaches get Gold privileges
  }, [isAuthenticated, user]);

  // Courts matching the currently selected facility
  const matchingCourts = useMemo(() => {
    if (!selectedFacility) return [];
    return backendCourts.filter((c) => c.sport_type === selectedFacility.sportKey);
  }, [selectedFacility, backendCourts]);

  // Open booking modal for a facility
  const handleOpenBooking = (facility: CourtFacility) => {
    setSelectedFacility(facility);
    setBookingSuccess(null);
    setBookingError(null);
    setSelectedSlot(null);

    // Default to first matching backend court
    const matches = backendCourts.filter((c) => c.sport_type === facility.sportKey);
    if (matches.length > 0) {
      setSelectedCourtId(matches[0].id);
    } else {
      setSelectedCourtId(null);
    }

    if (!isAuthenticated) {
      setBookingTab("member");
    }
  };

  // Fetch slot availability when court or date changes
  const fetchAvailability = useCallback(async () => {
    if (!selectedCourtId || !selectedDate) return;
    setLoadingSlots(true);
    setBookingError(null);
    setSelectedSlot(null);

    try {
      const res = await apiClient.get<{ courts: { id: number; slots: TimeSlot[] }[] }>(
        `/courts/availability?date=${selectedDate}&court_id=${selectedCourtId}`
      );
      if (res?.courts && res.courts.length > 0) {
        setAvailableSlots(res.courts[0].slots || []);
      } else {
        setAvailableSlots([]);
      }
    } catch (err: any) {
      console.error("Failed to load availability:", err);
      setBookingError("Unable to fetch court availability slots. Please try again.");
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedCourtId, selectedDate]);

  useEffect(() => {
    if (selectedCourtId && selectedDate) {
      fetchAvailability();
    }
  }, [selectedCourtId, selectedDate, fetchAvailability]);

  // Calculate dynamic price breakdown from backend
  useEffect(() => {
    if (!selectedCourtId) return;

    const tierToQuery = bookingTab === "guest" || !isAuthenticated ? "WALK_IN" : effectiveTier;

    apiClient
      .get<PriceBreakdown>(
        `/bookings/calculate-price?court_id=${selectedCourtId}&tier=${tierToQuery}&date=${selectedDate}`
      )
      .then((data) => {
        if (data) setPriceBreakdown(data);
      })
      .catch((err) => {
        console.error("Failed to fetch price breakdown:", err);
      });
  }, [selectedCourtId, effectiveTier, selectedDate, bookingTab, isAuthenticated]);

  // Handle final booking submission
  const handleConfirmReservation = async () => {
    if (!selectedCourtId || !selectedSlot) {
      setBookingError("Please select a date, court, and time slot.");
      return;
    }

    setBookingError(null);
    setIsSubmitting(true);

    try {
      if (isAuthenticated && bookingTab === "member") {
        // Authenticated Member Booking
        const res = await apiClient.post<{ booking: any }>("/bookings", {
          court_id: selectedCourtId,
          start_time: selectedSlot.start_datetime,
          notes: bookingNotes || undefined,
        });

        // Immediately update client-side user bookings so they appear in profile
        if (user && selectedFacility) {
          const chosenCourt = matchingCourts.find((c) => c.id === selectedCourtId);
          const newBookingItem = {
            id: `BK-${Date.now()}`,
            bookingCode: (res as any)?.booking_reference || (res as any)?.data?.booking_reference || `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            courtName: chosenCourt?.name || selectedFacility.name,
            sport: selectedFacility.sport,
            surface: chosenCourt?.surface_type || selectedFacility.surface,
            date: selectedDate,
            timeSlot: `${selectedSlot.start_time} - ${selectedSlot.end_time}`,
            status: "CONFIRMED" as const,
            amount: (res as any)?.final_price ?? (res as any)?.data?.final_price ?? priceBreakdown?.final_price ?? 0,
          };
          const updatedUser = {
            ...user,
            bookings: [newBookingItem, ...(user.bookings || [])],
          };
          setStoredUser(updatedUser);
        }

        setBookingSuccess(res);
        fetchAvailability();
      } else {
        // Guest Walk-In Booking
        if (!guestName.trim()) {
          setBookingError("Guest name is required for walk-in bookings.");
          setIsSubmitting(false);
          return;
        }

        const res = await apiClient.post<{ booking: any }>("/bookings/guest", {
          court_id: selectedCourtId,
          start_time: selectedSlot.start_datetime,
          is_walk_in: true,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim() || "+91 98765 00000",
          guest_email: guestEmail.trim() || undefined,
          notes: bookingNotes || undefined,
        });
        setBookingSuccess(res);
        fetchAvailability();
      }
    } catch (err: any) {
      setBookingError(err?.message || "Failed to confirm booking. The slot might already be reserved.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCourts =
    filterSport === "all"
      ? courtFacilities
      : courtFacilities.filter((c) => {
          const key = c.sport.toLowerCase().replace(/\s+/g, "-");
          return key === filterSport;
        });

  // Today, tomorrow, day after date chips
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const label =
        i === 0
          ? "Today"
          : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      dates.push({ iso, label });
    }
    return dates;
  }, []);

  return (
    <section id="courts" className="py-20 bg-slate-50/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3 border border-sky-200">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>16+ Championship Playing Venues</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
            Court Booking & Live Reservation Engine
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-2xl mx-auto">
            Dynamic real-time reservation connected to our club management system. Members enjoy exclusive tiered discounts with zero court booking fees for Gold Champions.
          </p>

          {/* Member Tier Benefits Banner - Clean Responsive Grid with Professional Lucide Icons */}
          <div className="mt-6 p-3 sm:p-4 rounded-2xl bg-white/95 border border-sky-100 shadow-sm backdrop-blur-md grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/70 border border-amber-100/80">
              <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                <Crown className="w-4 h-4 text-amber-700" />
              </span>
              <div className="text-left min-w-0">
                <span className="font-extrabold text-slate-900 block truncate">Gold Champion</span>
                <span className="text-emerald-700 font-bold block text-[11px] truncate">100% OFF (Free)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-sky-50/70 border border-sky-100/80">
              <span className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-sky-700" />
              </span>
              <div className="text-left min-w-0">
                <span className="font-extrabold text-slate-900 block truncate">Silver Member</span>
                <span className="text-sky-700 font-bold block text-[11px] truncate">50% Privilege</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100/80">
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
                <GraduationCap className="w-4 h-4 text-emerald-700" />
              </span>
              <div className="text-left min-w-0">
                <span className="font-extrabold text-slate-900 block truncate">Junior Academy</span>
                <span className="text-emerald-700 font-bold block text-[11px] truncate">50% Youth Subsidy</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-8 h-8 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 shadow-xs">
                <User className="w-4 h-4 text-slate-700" />
              </span>
              <div className="text-left min-w-0">
                <span className="font-extrabold text-slate-900 block truncate">Walk-in Guests</span>
                <span className="text-slate-600 font-semibold block text-[11px] truncate">Standard Rates</span>
              </div>
            </div>
          </div>

          {/* Filter Pills - Matching Hero UI/UX */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap mt-6">
            {[
              { id: "all", label: "All Arenas", count: "16 Arenas", icon: Trophy },
              { id: "tennis", label: "Lawn Tennis", count: "4 Courts", icon: CircleDot },
              { id: "cricket", label: "Box Cricket", count: "2 Arenas", icon: Target },
              { id: "table-tennis", label: "Table Tennis", count: "2 Tables", icon: Layers },
              { id: "badminton", label: "Badminton", count: "6 Arenas", icon: Activity },
              { id: "volleyball", label: "Volleyball", count: "Sand Arena", icon: Volleyball },
              { id: "swimming", label: "Swimming Pool", count: "Heated 50m", icon: Waves },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterSport(btn.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                  filterSport === btn.id
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25 scale-105"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <btn.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{btn.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    filterSport === btn.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Visual Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCourts.map((court) => {
            // Read dynamic price from pricingRules if available
            const dynamicBaseRate = pricingRules?.sport_rates?.[court.sportKey] ?? court.defaultPrice;
            const silverDiscounted = Math.round(dynamicBaseRate * 0.5);

            return (
              <div
                key={court.id}
                onClick={() => handleOpenBooking(court)}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-[11px] font-bold shadow-sm border border-white">
                      {court.count} {court.count === 1 ? "Venue" : "Courts"}
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
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors font-[family-name:var(--font-outfit)] mb-1 flex items-center gap-2">
                      <span className="text-sky-600">{getSportIcon(court.sportKey)}</span>
                      <span>{court.name}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 line-clamp-1">{court.surface}</p>

                    {/* Member Tier Highlight */}
                    <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Gold Champion:</span>
                      <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        FREE (100% OFF)
                      </span>
                    </div>

                    {/* Clean Spec Pills */}
                    <div className="flex items-center gap-2 flex-wrap mb-5">
                      <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                        {court.lighting}
                      </span>
                      <span className="text-[11px] font-semibold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg">
                        {court.pace}
                      </span>
                    </div>
                  </div>

                  {/* Price & Action Row */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">
                        Standard Rate
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-extrabold text-slate-900">
                          ₹{dynamicBaseRate}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">/ hr</span>
                      </div>
                      <span className="text-[10px] font-bold text-sky-700 block">
                        Silver: ₹{silverDiscounted}/hr
                      </span>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 group-hover:bg-sky-600 transition-colors shadow-sm"
                    >
                      <span>Book Court</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Interactive Booking Engine Modal */}
        {selectedFacility && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full my-6 overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="relative aspect-[21/9] sm:aspect-[24/8] w-full bg-slate-900 shrink-0">
                <Image
                  src={selectedFacility.image}
                  alt={selectedFacility.name}
                  fill
                  className="object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                <button
                  onClick={() => setSelectedFacility(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="absolute bottom-3 left-5 right-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-bold uppercase tracking-wider">
                      {selectedFacility.sport}
                    </span>
                    <span className="text-xs text-sky-200 font-medium">
                      Operating Hours: 06:00 AM – 10:00 PM
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black font-[family-name:var(--font-outfit)]">
                    {selectedFacility.name}
                  </h3>
                </div>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
                {/* 1. Member Status & Discount Header */}
                {isAuthenticated && user ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200/80 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                        {user.first_name ? user.first_name[0] : user.name ? user.name[0] : "M"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{user.name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white text-sky-800 border border-sky-200 shadow-2xs">
                            {effectiveTier} MEMBER
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 block mt-0.5">
                          {effectiveTier === "GOLD"
                            ? "👑 Gold Champion Benefit: 100% OFF All Court Bookings"
                            : effectiveTier === "SILVER"
                            ? "🥈 Silver Privilege: 50% Court Fee Discount Applied"
                            : effectiveTier === "JUNIOR"
                            ? "🎾 Junior Academy: 50% Youth Subsidy Applied"
                            : "Club Member Access"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Your Discount</span>
                      <span className="text-base font-black text-emerald-700">
                        {effectiveTier === "GOLD" ? "100% FREE" : "50% OFF"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">
                            Are you a Champions Club Member?
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Sign in to automatically claim up to 100% discount on all court bookings!
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/login"
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs shrink-0 transition-colors"
                      >
                        Sign In
                      </Link>
                    </div>

                    {/* Booking Mode Switcher for Non-Logged In Users */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={() => setBookingTab("member")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          bookingTab === "member"
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700 hover:bg-amber-100"
                        }`}
                      >
                        Member Login
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingTab("guest")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          bookingTab === "guest"
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700 hover:bg-amber-100"
                        }`}
                      >
                        Book as Walk-in Guest (Standard Rate)
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Success Alert */}
                {bookingSuccess && (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-extrabold text-emerald-900">
                          Reservation Confirmed!
                        </h4>
                        <p className="text-xs text-emerald-800 mt-1">
                          Your court booking reference is{" "}
                          <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 font-black text-emerald-900">
                            {bookingSuccess.data?.booking_reference || "CONFIRMED"}
                          </strong>
                        </p>
                        <div className="mt-3 p-3 rounded-xl bg-white/80 border border-emerald-200/80 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Reserved Slot:</span>
                            <span className="font-bold text-slate-900">
                              {selectedDate} · {selectedSlot?.start_time} - {selectedSlot?.end_time}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Amount Paid / Due:</span>
                            <span className="font-bold text-emerald-700">
                              ₹{bookingSuccess.data?.final_price ?? priceBreakdown?.final_price ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 flex-wrap">
                          <Link
                            href={
                              isOwner(user)
                                ? "/bookings"
                                : isAuthenticated
                                ? "/profile/member?tab=bookings"
                                : "/login"
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors shadow-xs"
                          >
                            {isOwner(user) ? "View Master Schedule" : "View My Bookings"}
                          </Link>
                          <button
                            onClick={() => {
                              setBookingSuccess(null);
                              setSelectedSlot(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-white text-slate-700 font-bold text-xs border border-slate-200 hover:bg-slate-50 transition-colors"
                          >
                            Book Another Slot
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Error Alert */}
                {bookingError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {!bookingSuccess && (
                  <>
                    {/* Step 1: Select Venue / Court Surface */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-sky-600" />
                        <span>1. Select Playing Court Venue ({matchingCourts.length} Available)</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingCourts.map((court) => (
                          <button
                            key={court.id}
                            type="button"
                            onClick={() => setSelectedCourtId(court.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                              selectedCourtId === court.id
                                ? "bg-sky-50 border-sky-500 text-sky-950 font-bold ring-2 ring-sky-500/20"
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <span className="text-xs font-extrabold block">{court.name}</span>
                              <span className="text-[11px] text-slate-500 block">
                                {court.surface_type || "Standard Surface"}
                              </span>
                            </div>
                            {selectedCourtId === court.id && (
                              <Check className="w-4 h-4 text-sky-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 2: Select Date */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-sky-600" />
                          <span>2. Select Reservation Date</span>
                        </label>
                        <input
                          type="date"
                          value={selectedDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 bg-white font-medium focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {dateOptions.map((opt) => (
                          <button
                            key={opt.iso}
                            type="button"
                            onClick={() => setSelectedDate(opt.iso)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                              selectedDate === opt.iso
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Step 3: Select 60-Minute Time Slot */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>3. Select 60-Minute Session Slot</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => fetchAvailability()}
                          className="text-xs text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingSlots ? "animate-spin" : ""}`} />
                          <span>Refresh Slots</span>
                        </button>
                      </div>

                      {loadingSlots ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                          <span>Checking real-time court availability...</span>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                          No open slots found for this date. Please select another date or court.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-2xl">
                          {availableSlots
                            // Show full 1-hour slots matching standard operating hours
                            .filter((_, idx) => idx % 2 === 0)
                            .map((slot) => {
                              const isSelected =
                                selectedSlot?.start_datetime === slot.start_datetime;
                              return (
                                <button
                                  key={slot.start_datetime}
                                  type="button"
                                  disabled={!slot.is_available}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`p-2.5 rounded-xl border text-center transition-all ${
                                    isSelected
                                      ? "bg-sky-600 text-white border-sky-600 font-black shadow-xs ring-2 ring-sky-500/20"
                                      : slot.is_available
                                      ? "bg-white border-slate-200 text-slate-800 hover:border-sky-300 hover:bg-sky-50/50 font-bold"
                                      : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed text-opacity-50"
                                  }`}
                                >
                                  <span className="text-xs block">{slot.start_time} - {slot.end_time}</span>
                                  <span
                                    className={`text-[10px] block mt-0.5 ${
                                      isSelected
                                        ? "text-sky-100 font-extrabold"
                                        : slot.is_available
                                        ? "text-emerald-600 font-semibold"
                                        : "text-slate-400 font-medium"
                                    }`}
                                  >
                                    {slot.is_available ? "Available" : "Booked"}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Step 4: Guest Information (If Walk-in) */}
                    {(!isAuthenticated || bookingTab === "guest") && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                          Walk-in Guest Contact Details
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 block mb-1">
                              Player Full Name *
                            </span>
                            <div className="relative">
                              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="e.g. Rahul Sharma"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500 font-medium text-slate-800"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 block mb-1">
                              Phone Number *
                            </span>
                            <div className="relative">
                              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="+91 98765 43210"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500 font-medium text-slate-800"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 5: Live Backend Dynamic Pricing Breakdown */}
                    {priceBreakdown && (
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Standard Hourly Court Fee:</span>
                          <span className="font-bold text-slate-800">
                            ₹{priceBreakdown.base_price.toFixed(2)}
                          </span>
                        </div>

                        {priceBreakdown.discount_amount > 0 && (
                          <div className="flex justify-between items-center text-emerald-700">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              <span>{priceBreakdown.description}:</span>
                            </span>
                            <span className="font-extrabold">
                              - ₹{priceBreakdown.discount_amount.toFixed(2)} ({priceBreakdown.discount_percentage}%)
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                          <div>
                            <span className="text-sm font-extrabold text-slate-900 block">
                              Total Amount Due:
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {priceBreakdown.final_price === 0
                                ? "Covered 100% by Gold Club Membership"
                                : "Payable via Club tab or at Reception"}
                            </span>
                          </div>
                          <span className="text-xl font-black text-slate-900">
                            {priceBreakdown.final_price === 0 ? (
                              <span className="text-emerald-700">₹0.00 (FREE)</span>
                            ) : (
                              `₹${priceBreakdown.final_price.toFixed(2)}`
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleConfirmReservation}
                        disabled={isSubmitting || !selectedSlot}
                        className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-bold text-center text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                          !selectedSlot
                            ? "bg-slate-300 cursor-not-allowed"
                            : "bg-sky-600 hover:bg-sky-700 shadow-sky-500/25 active:scale-98"
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Securing Court Reservation...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>
                              Confirm & Reserve Slot{" "}
                              {selectedSlot
                                ? `(${selectedSlot.start_time} - ${selectedSlot.end_time})`
                                : ""}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedFacility(null)}
                        className="py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
