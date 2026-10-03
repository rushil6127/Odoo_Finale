/**
 * Champions Club — Dashboard Routes Layout
 *
 * Wraps all authenticated routes with the DashboardLayout shell.
 */

import { DashboardLayout } from "@/components/layout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
