import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ClubNameMarquee from "@/components/landing/ClubNameMarquee";
import AutoImageGallery from "@/components/landing/AutoImageGallery";
import CourtsShowcase from "@/components/landing/CourtsShowcase";
import MembershipPlans from "@/components/landing/MembershipPlans";
import ProShopAndCafe from "@/components/landing/ProShopAndCafe";
import EnquiryCrmSection from "@/components/landing/EnquiryCrmSection";
import Footer from "@/components/landing/Footer";

async function getMembershipPlans() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
    const res = await fetch(`${apiUrl}/membership-plans`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.plans || null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const plans = await getMembershipPlans();

  return (
    <main className="min-h-screen bg-white flex flex-col selection:bg-sky-200 selection:text-sky-900">
      {/* Floating Pill Navbar inspired by isaitnu & reference */}
      <Navbar />

      {/* Hero Section with Scroll Animations & Quick Finder */}
      <HeroSection />

      {/* Continuous Infinite Sliding Marquee Ribbon */}
      <ClubNameMarquee />

      {/* Auto-scrolling Visual Photo Gallery */}
      <AutoImageGallery />

      {/* Courts & Multiple Surfaces Showcase */}
      <CourtsShowcase />

      {/* Membership Tiers & Breakdown (Gold, Silver, Junior) */}
      <MembershipPlans initialPlans={plans} />

      {/* Pro Shop Retail & Champions Lounge Cafeteria */}
      <ProShopAndCafe />

      {/* Trial Session Enquiry & CRM Lead Capture */}
      <EnquiryCrmSection />

      {/* Comprehensive Club Details Footer */}
      <Footer />
    </main>
  );
}
