import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Champions Club — Elite Sports & Country Resort",
  description: "Gujarat's premier multi-sport country club featuring Wimbledon grass courts, Roland-Garros clay, Olympic aquatic center, pro shop, and modern digital booking operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${plusJakarta.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col antialiased bg-white text-slate-900 font-sans">
        {children}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
