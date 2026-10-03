"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  User,
  History,
  ChevronRight,
  Loader2,
  Search,
  Check
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api/client";

interface Court {
  id: number;
  name: string;
  sport_type: string;
  surface_type?: string;
  is_indoor: boolean;
  status: string;
  total_candidate_slots?: number;
  available_slots_count?: number;
  slots?: Slot[];
}

interface Slot {
  slot_index: number;
  start_time: string;
  end_time: string;
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  is_available: boolean;
  reason?: string | null;
}

interface BookingHistoryItem {
  id: number;
  booking_reference: string;
  court_id: number;
  court_name: string;
  sport_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  base_price?: number;
  final_price?: number;
}

const SPORTS = [
  { id: "BADMINTON", name: "Badminton", icon: "🏸" },
  { id: "LAWN_TENNIS", name: "Lawn Tennis", icon: "🎾" },
  { id: "BOX_CRICKET", name: "Box Cricket", icon: "🏏" },
  { id: "TABLE_TENNIS", name: "Table Tennis", icon: "🏓" },
  { id: "SWIMMING_POOL", name: "Swimming Pool", icon: "🏊‍♂️" },
  { id: "VOLLEYBALL", name: "Volleyball", icon: "🏐" },
];

export default function MemberBookingView() {
  const [activeTab, setActiveTab] = useState<"BOOK" | "HISTORY">("BOOK");

  // Booking Flow State
  const [selectedSport, setSelectedSport] = useState<string>("BADMINTON");
  
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split("T")[0]);
  
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  
  // History State
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchAvailability = useCallback(async () => {
    try {
      setLoadingCourts(true);
      setFetchError(null);
      
      const res = await apiClient.get<any>(`/courts/availability?date=${selectedDate}&sport_type=${selectedSport}`);
      if (res && res.courts) {
        setCourts(res.courts);
      } else {
        setCourts([]);
      }
      
      // Clear selection if it is no longer valid
      setSelectedCourt(null);
      setSelectedSlot(null);
    } catch (err: any) {
      console.error("Failed to fetch availability:", err);
      setFetchError(err.message || "Failed to load availability.");
      setCourts([]);
    } finally {
      setLoadingCourts(false);
    }
  }, [selectedDate, selectedSport]);

  useEffect(() => {
    if (activeTab === "BOOK") {
      fetchAvailability();
    }
  }, [fetchAvailability, activeTab]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.get<any>("/bookings/my-history");
      setHistory(res || []);
    } catch (err: any) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "HISTORY") {
      fetchHistory();
    }
  }, [fetchHistory, activeTab]);

  const handleConfirmBooking = async () => {
    if (!selectedCourt || !selectedSlot) return;

    try {
      setConfirming(true);
      setFetchError(null);
      const payload = {
        court_id: selectedCourt.id,
        start_time: selectedSlot.start_datetime,
      };

      const res = await apiClient.post<any>("/bookings", payload);
      setConfirmedBooking(res);
      // Refresh availability in background
      fetchAvailability();
    } catch (err: any) {
      console.error("Booking failed:", err);
      if (err instanceof ApiError) {
        setFetchError(err.message || "That slot was just booked by another member. Please select another time.");
      } else {
        setFetchError("An unexpected error occurred.");
      }
      // Refresh in case someone else took it
      fetchAvailability();
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      setCancellingId(bookingId);
      await apiClient.post(`/bookings/${bookingId}/cancel`);
      fetchHistory();
    } catch (err: any) {
      alert(err.message || "Failed to cancel booking.");
    } finally {
      setCancellingId(null);
    }
  };

  // ----------------------------------------------------
  // Render Helpers
  // ----------------------------------------------------

  const renderSuccess = () => (
    <div className="bg-white rounded-2xl p-8 border border-zinc-200 shadow-sm text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Booking Confirmed!</h2>
        <p className="text-sm text-zinc-500 mt-1">Your court has been successfully reserved.</p>
      </div>

      <div className="bg-zinc-50 rounded-xl p-6 text-left max-w-sm mx-auto space-y-3">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-200">
          <span className="text-zinc-500 text-sm">Reference</span>
          <span className="font-mono font-bold text-zinc-900">{confirmedBooking?.booking_reference || "BK-XXXXXX"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Sport</span>
          <span className="font-medium text-zinc-900">{confirmedBooking?.sport_type?.replace("_", " ")}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Court</span>
          <span className="font-medium text-zinc-900">{confirmedBooking?.court_name || "Court"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Date</span>
          <span className="font-medium text-zinc-900">{confirmedBooking?.booking_date}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Time</span>
          <span className="font-medium text-emerald-600">
            {confirmedBooking?.start_time ? new Date(confirmedBooking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""} 
            {" - "}
            {confirmedBooking?.end_time ? new Date(confirmedBooking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
          </span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
          <span className="text-zinc-500 text-sm">Final Price</span>
          <span className="font-bold text-zinc-900">₹{confirmedBooking?.final_price || 0}</span>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => {
            setConfirmedBooking(null);
            setSelectedCourt(null);
            setSelectedSlot(null);
          }}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Book Another
        </button>
        <button
          onClick={() => {
            setConfirmedBooking(null);
            setSelectedCourt(null);
            setSelectedSlot(null);
            setActiveTab("HISTORY");
          }}
          className="px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl transition-colors"
        >
          View My Bookings
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Book a Court</h1>
          <p className="text-sm text-zinc-500 mt-1">Choose your sport, date and time to reserve your next session.</p>
        </div>
        
        <div className="flex bg-zinc-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("BOOK")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "BOOK" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            New Reservation
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "HISTORY" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            My Bookings
          </button>
        </div>
      </div>

      {activeTab === "BOOK" && (
        confirmedBooking ? renderSuccess() : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Selection Area */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Error Alert */}
              {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{fetchError}</p>
                </div>
              )}

              {/* 1. Sport Selection */}
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">1</span>
                  Select Sport
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SPORTS.map((sport) => (
                    <button
                      key={sport.id}
                      onClick={() => {
                        setSelectedSport(sport.id);
                        setSelectedCourt(null);
                        setSelectedSlot(null);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedSport === sport.id
                          ? "bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                          : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="text-2xl mb-2">{sport.icon}</div>
                      <div className={`text-sm font-bold ${selectedSport === sport.id ? "text-emerald-900" : "text-zinc-900"}`}>
                        {sport.name}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* 2. Date Selection */}
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">2</span>
                  Select Date
                </h2>
                <input
                  type="date"
                  value={selectedDate}
                  min={today.toISOString().split("T")[0]}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedCourt(null);
                    setSelectedSlot(null);
                  }}
                  className="w-full md:w-64 px-4 py-3 bg-white border border-zinc-200 rounded-xl text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </section>

              {/* 3. Court & Time Selection */}
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">3</span>
                  Select Court & Time
                </h2>
                
                {loadingCourts ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-zinc-200">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-sm text-zinc-500 mt-3">Loading availability...</p>
                  </div>
                ) : courts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-zinc-200">
                    <AlertCircle className="w-8 h-8 text-zinc-400" />
                    <p className="text-sm font-medium text-zinc-600 mt-3">No active courts are available for this sport.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {courts.map((court) => (
                      <div key={court.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-zinc-900">{court.name}</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">{court.surface_type} • {court.is_indoor ? "Indoor" : "Outdoor"}</p>
                          </div>
                          {court.available_slots_count === 0 && (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-md">Fully Booked</span>
                          )}
                        </div>
                        
                        <div className="p-4">
                          {court.slots && court.slots.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {court.slots.map((slot) => {
                                const isSelected = selectedCourt?.id === court.id && selectedSlot?.start_datetime === slot.start_datetime;
                                
                                return (
                                  <button
                                    key={slot.start_datetime}
                                    disabled={!slot.is_available}
                                    onClick={() => {
                                      setSelectedCourt(court);
                                      setSelectedSlot(slot);
                                    }}
                                    className={`
                                      py-2 px-1 text-xs font-semibold rounded-lg border transition-all flex flex-col items-center gap-1
                                      ${slot.is_available 
                                        ? isSelected
                                          ? "bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-600 ring-offset-1"
                                          : "bg-white border-zinc-200 text-zinc-700 hover:border-emerald-400 hover:text-emerald-700"
                                        : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed"
                                      }
                                    `}
                                  >
                                    <span>{slot.start_time}</span>
                                    {slot.is_available ? (
                                      <span className={isSelected ? "text-emerald-100" : "text-emerald-500"}>Available</span>
                                    ) : (
                                      <span className="text-zinc-400">Booked</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500">No available sessions for this date.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Sticky Summary Area */}
            <div className="lg:col-span-4 relative">
              <div className="sticky top-6 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden">
                <div className="bg-zinc-900 p-5 text-white">
                  <h3 className="font-bold text-lg">Booking Summary</h3>
                </div>
                
                <div className="p-5 space-y-4">
                  {selectedCourt && selectedSlot ? (
                    <>
                      <div className="space-y-3 pb-4 border-b border-zinc-100 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Sport</span>
                          <span className="font-semibold text-zinc-900">{selectedSport.replace("_", " ")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Date</span>
                          <span className="font-semibold text-zinc-900">{selectedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Court</span>
                          <span className="font-semibold text-zinc-900">{selectedCourt.name}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-zinc-500">Time</span>
                          <div className="text-right">
                            <span className="font-semibold text-emerald-600 block">{selectedSlot.start_time} - {selectedSlot.end_time}</span>
                            <span className="text-xs text-zinc-500">{selectedSlot.duration_minutes} mins</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-2">
                        <p className="text-xs text-zinc-500 text-center mb-4">
                          Final pricing and membership discounts will be applied upon confirmation.
                        </p>
                        
                        <button
                          disabled={confirming}
                          onClick={handleConfirmBooking}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-70"
                        >
                          {confirming ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Booking"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-zinc-400 space-y-3">
                      <CalendarIcon className="w-8 h-8 mx-auto opacity-50" />
                      <p className="text-sm">Select a sport, date, court and time to see your summary.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* History Tab */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-500 mt-3">Loading your bookings...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <History className="w-12 h-12 text-zinc-300 mb-4" />
              <h3 className="text-lg font-bold text-zinc-900">No Bookings Yet</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">You haven&apos;t made any court reservations yet. Go to the New Reservation tab to book a court.</p>
              <button
                onClick={() => setActiveTab("BOOK")}
                className="mt-6 px-6 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800"
              >
                Book Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto p-4 sm:p-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Booking Ref</th>
                    <th className="pb-3 font-semibold">Date & Time</th>
                    <th className="pb-3 font-semibold">Court</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Price</th>
                    <th className="pb-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.map((booking) => {
                    const startStr = booking.start_time ? new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const endStr = booking.end_time ? new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const isConfirmed = booking.status === "CONFIRMED";
                    
                    return (
                      <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-4 font-mono font-medium text-zinc-900">{booking.booking_reference}</td>
                        <td className="py-4">
                          <div className="font-semibold text-zinc-900">{booking.booking_date}</div>
                          <div className="text-xs text-zinc-500">{startStr} - {endStr}</div>
                        </td>
                        <td className="py-4">
                          <div className="font-semibold text-zinc-900">{booking.court_name}</div>
                          <div className="text-xs text-zinc-500">{booking.sport_type?.replace("_", " ")}</div>
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isConfirmed
                                ? "bg-emerald-50 text-emerald-700"
                                : booking.status === "COMPLETED"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-4 font-bold text-zinc-900 text-right">
                          ₹{booking.final_price || 0}
                        </td>
                        <td className="py-4 text-right pr-2">
                          {isConfirmed && (
                            <button
                              disabled={cancellingId === booking.id}
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {cancellingId === booking.id ? "Cancelling..." : "Cancel"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
