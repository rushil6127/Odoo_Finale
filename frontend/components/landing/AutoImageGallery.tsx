"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Sparkles
} from "lucide-react";

interface GallerySlide {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  image: string;
  description: string;
  tag: string;
}

const gallerySlides: GallerySlide[] = [
  {
    id: 1,
    title: "Championship Natural Grass Courts",
    subtitle: "Wimbledon-Standard Fast Turf",
    category: "Tennis Grounds",
    image: "/images/grass-court.jpg",
    description: "4 precision-mowed natural lawn courts equipped with broadcast-grade LED floodlights for morning & night tournament play.",
    tag: "Grass Surface #1-4",
  },
  {
    id: 2,
    title: "Olympic Aquatic & Wellness Center",
    subtitle: "Heated 50-Meter Swimming Pool",
    category: "Aquatics & Recovery",
    image: "/images/pool.jpg",
    description: "Temperature-controlled 8-lane Olympic lap pool, hydromassage recovery loungers, and poolside cafeteria refreshment bar.",
    tag: "Aquatics Arena",
  },
  {
    id: 3,
    title: "The Champions Club Players Lounge & Pro Shop",
    subtitle: "Counter Sales, Espresso Bar & Gear",
    category: "Clubhouse & Retail",
    image: "/images/lounge.jpg",
    description: "Full-service pro shop stocking tour-level rackets, apparel, strings, with a panoramic view of center court and artisan cafe.",
    tag: "Clubhouse & POS",
  },
];

export default function AutoImageGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % gallerySlides.length);
    }, 4000); // Transitions smoothly every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + gallerySlides.length) % gallerySlides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % gallerySlides.length);
  };

  const current = gallerySlides[currentIndex];

  return (
    <section id="gallery" className="py-20 bg-slate-50 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-lime-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Camera className="w-3.5 h-3.5" />
            <span>Campus Visual Tour</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            World-Class Arenas & Amenities
          </h2>
          <p className="text-slate-600 text-sm mt-1 max-w-xl">
            Tour our tournament courts, clubhouse, swimming pavilion, and state-of-the-art sporting facilities.
          </p>
        </div>

        {/* Featured Large Slide Showcase */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-900 aspect-[16/9] max-h-[580px] group">
          {/* Main Slide Image */}
          <div className="relative w-full h-full">
            <Image
              src={current.image}
              alt={current.title}
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover object-center transition-all duration-700 group-hover:scale-105"
              priority
            />
            {/* Vignette Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-transparent hidden md:block" />
          </div>

          {/* Top Badges */}
          <div className="absolute top-6 left-6 flex items-center gap-2 z-20">
            <span className="px-3.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 text-xs font-extrabold shadow-md border border-white">
              {current.category}
            </span>
            <span className="px-3 py-1 rounded-full bg-lime-400 text-slate-950 text-xs font-extrabold shadow-md">
              {current.tag}
            </span>
          </div>

          {/* PREVIOUS BUTTON DIRECTLY ON PHOTO (LEFT) */}
          <button
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-xl backdrop-blur-md flex items-center justify-center border border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* NEXT BUTTON DIRECTLY ON PHOTO (RIGHT) */}
          <button
            onClick={handleNext}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-xl backdrop-blur-md flex items-center justify-center border border-white/60 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Bottom Content Overlay */}
          <div className="absolute bottom-6 left-6 right-6 md:right-auto md:max-w-xl text-white z-20">
            <div className="text-sky-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{current.subtitle}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white">
              {current.title}
            </h3>
            <p className="text-slate-200 text-xs sm:text-sm leading-relaxed mb-4 line-clamp-2 sm:line-clamp-none">
              {current.description}
            </p>

            {/* Slide Progress Dots */}
            <div className="flex items-center gap-2">
              {gallerySlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex
                      ? "w-8 bg-sky-400"
                      : "w-2 bg-white/50 hover:bg-white"
                    }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Thumbnail Preview Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {gallerySlides.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentIndex(idx)}
              className={`p-3.5 rounded-2xl text-left transition-all duration-200 flex items-center gap-3.5 border ${idx === currentIndex
                  ? "bg-white border-sky-400 shadow-md ring-2 ring-sky-400/20"
                  : "bg-white/60 hover:bg-white border-slate-200"
                }`}
            >
              <div className="w-14 h-14 rounded-xl relative overflow-hidden shrink-0 border border-slate-200">
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">
                  {slide.category}
                </div>
                <div className="text-xs font-extrabold text-slate-900 truncate">
                  {slide.title}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {slide.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
