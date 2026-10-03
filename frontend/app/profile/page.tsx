/**
 * Champions Club — Profile Router & Dispatcher (/profile)
 *
 * Automatically inspects the authenticated user's role and redirects to the exact dedicated profile:
 * - OWNER -> /profile/owner
 * - STAFF / COACH / ADMIN / MANAGER -> /profile/employee
 * - MEMBER -> /profile/member
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, getRoleProfilePath } from "@/lib/auth";
import ProfileViewContainer from "@/components/profile/ProfileViewContainer";

export default function ProfileRouterPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading) {
      const destination = getRoleProfilePath(user);
      router.replace(destination);
    }
  }, [user, isLoading, router]);

  return <ProfileViewContainer />;
}
