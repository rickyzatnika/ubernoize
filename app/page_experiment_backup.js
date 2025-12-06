"use client";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import ClientDate from "./components/FormatDate";
import Image from "next/image";

const fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to fetch");
  }
  return r.json();
};

function Carousel({ events }) {
  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);

  const scrollToIndex = (i) => {
    if (!containerRef.current) return;
    const cardWidth = 400; // card width + gap approx
    containerRef.current.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
    setIndex(i);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = 400;
      const current = Math.round(el.scrollLeft / cardWidth);
      setIndex(current);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative">
      {/* Left Arrow */}
      <button
        onClick={() => scrollToIndex(Math.max(0, index - 1))}
        className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        aria-label="Prev"
      >
        ←
      </button>

      {/* Right Arrow */}
      <button
        onClick={() => scrollToIndex(Math.min(events.length - 1, index + 1))}
        className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        aria-label="Next"
      >
        →
      </button>

      {/* Scrollable container */}
      <div ref={containerRef} className="overflow-x-scroll pb-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-red-500/50">
        <div className="flex gap-6 px-2 w-max">
          {events.map((event) => (
            <div key={event._id} className="group relative flex-shrink-0 w-96">
              {/* Card content injected below by existing markup */}
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center mt-6 gap-2">
        {events.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToIndex(i)}
            className={`w-2.5 h-2.5 rounded-full border ${i === index ? 'bg-red-500 border-red-500' : 'bg-white/20 border-white/30 hover:bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR("/api/events", fetcher, { refreshInterval: 8000 });

  // Filter untuk event yang sedang berjalan saja (upcoming events)
  const upcomingEvents = data?.events?.filter(event => {
    const eventDate = new Date(event.date);
    const now = new Date();
    return eventDate > now; // Hanya event yang belum berlalu
  }) || [];

  return (
    <div className="min-h-screen bg-black">
      {/* Fullscreen Background dengan Events Langsung */}
      <div className="relative min-h-screen">
        {/* Full background image */}
        <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center bg-no-repeat"></div>
        
        {/* Enhanced gradient overlays untuk readability yang lebih baik */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/95"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/60 via-black/30 to-black/80"></div>
        
      
        {/* Events Section - Langsung tampil tanpa hero content */}
        <section className="relative z-20 px-6 pb-20 ">
          <div className="max-w-7xl mx-auto">
            {/* Section Header dengan styling yang lebih baik */}
            <div className="text-center mb-16">
             
              
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white pt-14">
                <span className="bg-gradient-to-r from-white via-red-200 to-red-400 bg-clip-text text-transparent drop-shadow-2xl">
                  ÜBER
                </span>
                <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
                  NOIZE
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
                Underground music events yang sedang berjalan dan siap untuk kamu nikmati
              </p>
            </div>

            {/* Loading/Error States */}
            {isLoading && (
              <div className="text-center py-20">
                <div className="animate-spin w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-6"></div>
                <p className="text-white text-xl font-medium">Loading live events...</p>
                <p className="text-gray-400 text-sm mt-2">Mengambil data event terbaru</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/60 border-2 border-red-500/60 text-red-200 p-8 rounded-2xl text-center mb-12 backdrop-blur-sm">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold mb-4">Gagal Memuat Event</h3>
                <p className="text-lg">{error.message}</p>
              </div>
            )}

            {/* No Events State */}
            {!isLoading && !error && upcomingEvents.length === 0 && (
              <div className="text-center py-32">
                <div className="text-8xl mb-8">🎤</div>
                <h2 className="text-4xl font-black text-white mb-6">Belum Ada Event Live</h2>
                <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
                  Event spektakuler segera hadir. Stay tuned untuk pengalaman underground terbaik!
                </p>
                {session?.user?.role === "admin" && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-500 hover:to-red-600 transition-all font-bold shadow-xl text-lg"
                  >
                    ⚙️ Kelola Event Baru
                    <span className="text-xl">→</span>
                  </Link>
                )}
              </div>
            )}

            {/* Events Carousel dengan navigation arrows */}
            {!isLoading && upcomingEvents.length > 0 && (
              <div className="relative">
                {/* Carousel container */}
                <div className="overflow-x-scroll pb-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-red-500/50" id="events-carousel">
                    <div className="flex gap-6 px-2 w-max">
                      {upcomingEvents.map((event) => (
                        <div key={event._id} className="group relative flex-shrink-0 w-96">
                          {/* Card content copied from existing markup */}
                          <div className="relative bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur-sm rounded-3xl overflow-hidden border border-gray-600/30 hover:border-red-500/60 transition-all duration-500 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/20">
                            {/* Header */}
                            <div className="relative overflow-hidden">
                              <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center opacity-30"></div>
                              <div className="absolute inset-0 bg-gradient-to-br from-red-900/80 via-black/60 to-gray-900/80"></div>
                              <div className="relative p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/30 backdrop-blur rounded-full text-red-100 text-xs font-bold border border-red-400/40">🎵 LIVE NOW</div>
                                  <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-full flex items-center justify-center border border-white/20"><span className="text-white text-xl">🎤</span></div>
                                </div>
                                <h3 className="text-2xl font-black text-white leading-tight mb-3 group-hover:text-red-200 transition-colors">
                                  <Link href={`/events/${event._id}`}>{event.name}</Link>
                                </h3>
                                <div className="flex items-center gap-4 text-gray-200 text-sm">
                                  <span className="flex items-center gap-1 font-medium"><span className="text-red-400">📍</span> {event.city}</span>
                                  <span className="flex items-center gap-1 font-medium"><span className="text-red-400">📅</span> <ClientDate value={event.date} /></span>
                                </div>
                              </div>
                            </div>
                            {/* Info */}
                            <div className="p-6">
                              <p className="text-gray-300 leading-relaxed mb-6 line-clamp-3 text-sm">{event.description}</p>
                              <div className="grid grid-cols-2 gap-3 mb-6">
                                {event.ticketTypes.slice(0, 4).map((ticket) => (
                                  <div key={ticket._id} className="bg-gray-800/60 border border-gray-600/40 rounded-lg p-3 text-center backdrop-blur-sm hover:bg-gray-700/60 hover:border-red-500/40 transition-all">
                                    <div className="text-xs font-medium text-gray-400 mb-1">{ticket.name}</div>
                                    <div className="text-lg font-black text-white mb-1">Rp {ticket.price.toLocaleString('id-ID')}</div>
                                    <div className="text-xs text-green-400 font-medium">{ticket.quota} tersisa</div>
                                  </div>
                                ))}
                              </div>
                              <Link href={`/events/${event._id}`} className="group/btn block w-full text-center py-4 px-6 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white font-black rounded-xl hover:from-red-500 hover:via-red-600 hover:to-red-700 transition-all duration-300 shadow-xl hover:shadow-red-500/40 hover:scale-105 border border-red-400/30">
                                <span className="flex items-center justify-center gap-2">
                                  <span className="text-xl">🎸</span>
                                  <span className="tracking-wide text-sm font-bold">BELI TIKET</span>
                                  <span className="text-xl transition-transform group-hover/btn:translate-x-2">→</span>
                                </span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dots */}
                  <div className="flex justify-center mt-6 gap-2">
                    {upcomingEvents.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const container = document.getElementById('events-carousel');
                          const cardWidth = 400;
                          container.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
                        }}
                        className="w-2.5 h-2.5 rounded-full border bg-white/20 border-white/30 hover:bg-red-500"
                      />
                    ))}
                  </div>
                </div>
                        <div className="relative bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur-sm rounded-3xl overflow-hidden border border-gray-600/30 hover:border-red-500/60 transition-all duration-500 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/20">
                          
                          {/* Event Header dengan background */}
                          <div className="relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center opacity-30"></div>
                            <div className="absolute inset-0 bg-gradient-to-br from-red-900/80 via-black/60 to-gray-900/80"></div>
                            
                            <div className="relative p-6">
                              <div className="flex items-center justify-between mb-4">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/30 backdrop-blur rounded-full text-red-100 text-xs font-bold border border-red-400/40">
                                  🎵 LIVE NOW
                                </div>
                                <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-full flex items-center justify-center border border-white/20">
                                  <span className="text-white text-xl">🎤</span>
                                </div>
                              </div>
                              
                              <h3 className="text-2xl font-black text-white leading-tight mb-3 group-hover:text-red-200 transition-colors">
                                <Link href={`/events/${event._id}`}>
                                  {event.name}
                                </Link>
                              </h3>
                              
                              <div className="flex items-center gap-4 text-gray-200 text-sm">
                                <span className="flex items-center gap-1 font-medium">
                                  <span className="text-red-400">📍</span> {event.city}
                                </span>
                                <span className="flex items-center gap-1 font-medium">
                                  <span className="text-red-400">📅</span> <ClientDate value={event.date} />
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Event Info */}
                          <div className="p-6">
                            <p className="text-gray-300 leading-relaxed mb-6 line-clamp-3 text-sm">
                              {event.description}
                            </p>
                            
                            {/* Ticket Types dalam carousel yang kompak */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                              {event.ticketTypes.slice(0, 4).map((ticket) => (
                                <div key={ticket._id} className="bg-gray-800/60 border border-gray-600/40 rounded-lg p-3 text-center backdrop-blur-sm hover:bg-gray-700/60 hover:border-red-500/40 transition-all">
                                  <div className="text-xs font-medium text-gray-400 mb-1">{ticket.name}</div>
                                  <div className="text-lg font-black text-white mb-1">
                                    Rp {ticket.price.toLocaleString('id-ID')}
                                  </div>
                                  <div className="text-xs text-green-400 font-medium">{ticket.quota} tersisa</div>
                                </div>
                              ))}
                            </div>

                            {/* Action Button yang kompak */}
                            <Link 
                              href={`/events/${event._id}`} 
                              className="group/btn block w-full text-center py-4 px-6 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white font-black rounded-xl hover:from-red-500 hover:via-red-600 hover:to-red-700 transition-all duration-300 shadow-xl hover:shadow-red-500/40 hover:scale-105 border border-red-400/30"
                            >
                              <span className="flex items-center justify-center gap-2">
                                <span className="text-xl">🎸</span>
                                <span className="tracking-wide text-sm font-bold">BELI TIKET</span>
                                <span className="text-xl transition-transform group-hover/btn:translate-x-2">→</span>
                              </span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Carousel Navigation Dots */}
                <div className="flex justify-center mt-8 gap-2">
                  {upcomingEvents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const container = document.querySelector('.overflow-x-scroll');
                        const cardWidth = 400; // w-96 + gap
                        container.scrollTo({
                          left: index * cardWidth,
                          behavior: 'smooth'
                        });
                      }}
                      className="w-3 h-3 rounded-full bg-white/30 hover:bg-red-500 transition-all duration-300 border border-white/20 hover:scale-125"
                    />
                  ))}
                </div>

                {/* Scroll Instructions */}
                <div className="text-center mt-6">
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-gray-300 text-sm">
                    <span className="text-red-400">←→</span>
                    <span>Scroll horizontal untuk melihat event lainnya</span>
                    <span className="text-red-400">🎵</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>
      </div>
    </div>
  );
}