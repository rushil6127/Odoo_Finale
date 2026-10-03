import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import AutoImageGallery from "@/components/landing/AutoImageGallery";
import CourtsShowcase from "@/components/landing/CourtsShowcase";
import MembershipPlans from "@/components/landing/MembershipPlans";
import ProShopAndCafe from "@/components/landing/ProShopAndCafe";
import EnquiryCrmSection from "@/components/landing/EnquiryCrmSection";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col selection:bg-sky-200 selection:text-sky-900">
      {/* Floating Pill Navbar inspired by isaitnu & reference */}
      <Navbar />

      {/* Hero Section with Scroll Animations & Quick Finder */}
      <HeroSection />

      {/* Auto-scrolling Visual Photo Gallery */}
      <AutoImageGallery />

      {/* Courts & Multiple Surfaces Showcase */}
      <CourtsShowcase />

      {/* Membership Tiers & Breakdown (Gold, Silver, Junior) */}
      <MembershipPlans />

      {/* Pro Shop Retail & Champions Lounge Cafeteria */}
      <ProShopAndCafe />

      {/* Trial Session Enquiry & CRM Lead Capture */}
      <EnquiryCrmSection />

      {/* Comprehensive Club Details Footer */}
      <Footer />
    </main>
  );
}
