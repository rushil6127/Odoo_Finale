import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FFFBF8] text-center">
      <div className="w-20 h-20 rounded-3xl bg-[#1E4B33]/10 flex items-center justify-center mb-6">
        <span className="text-4xl font-extrabold text-[#1E4B33]">404</span>
      </div>
      <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">
        Page Not Found
      </h1>
      <p className="text-sm text-[#5A5A5A] max-w-md mt-2 mb-8">
        The page you are looking for doesn&apos;t exist or has been moved. Check the URL or head back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard">
          <Button variant="primary" size="md">
            Return to Dashboard
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="md">
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}
