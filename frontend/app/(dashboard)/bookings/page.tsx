"use client";

import { useEffect, useState } from "react";
import { getStoredUser, AuthUser } from "@/lib/auth";
import MemberBookingView from "@/components/bookings/MemberBookingView";
import StaffBookingDashboard from "@/components/bookings/StaffBookingDashboard";
import { Loader2 } from "lucide-react";

export default function BookingsWrapperPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user as any);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Determine which view to render based on user role
  if (currentUser?.role === "MEMBER") {
    return <MemberBookingView />;
  }

  // Default to Staff Dashboard for OWNER, ADMIN, FRONT_DESK, COACH
  return <StaffBookingDashboard />;
}
