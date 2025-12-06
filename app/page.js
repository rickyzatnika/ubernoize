"use client";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ClientDate from "./components/FormatDate";

const fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to fetch");
  }
  return r.json();
};

export default function Home() {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR("/api/events", fetcher, { refreshInterval: 8000 });

  // Filter untuk event yang sedang berjalan saja (upcoming events)
  const upcomingEventsRaw = data?.events?.filter((event) => {
    const eventDate = new Date(event.date);
    const now = new Date();
    return eventDate > now; // Hanya event yang belum berlalu
  }) || [];

  // Enrich data untuk UI (min price, total quota) agar cepat dibaca user
  const upcomingEvents = upcomingEventsRaw.map((ev) => {
    const prices = (ev.ticketTypes || []).map((t) => Number(t.price) || 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const totalQuota = (ev.ticketTypes || []).reduce((acc, t) => acc + (Number(t.quota) || 0), 0);
    return { ...ev, minPrice, totalQuota };
  });

  // Hitung tinggi viewport dikurangi fixed navbar (jika ada)
  const [navHeight, setNavHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector('header');
    if (header) setNavHeight(header.offsetHeight || 0);
    const onResize = () => {
      if (header) setNavHeight(header.offsetHeight || 0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const minHeightStyle = { minHeight: `calc(100vh - ${navHeight}px)` };

  return (
    <div className="bg-black">
      {/* Fullscreen section dengan bigBackground dan tinggi disesuaikan navbar */}
      <div className="relative overflow-hidden" style={minHeightStyle}>
        {/* Full background image */}
        <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center bg-no-repeat"></div>

        {/* Gradient overlays untuk readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 via-transparent to-black/50"></div>





        {/* Events Section - Hanya yang sedang berjalan */}
        <section id="events" className="py-20 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            {/* Section Header */}
            <div className="text-center mb-10 md:mb-14">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/10 backdrop-blur rounded-full border border-white/20 text-red-200 text-sm md:text-base font-semibold mb-5">
                <span className="text-lg">🎵</span>
                <span>Underground Music Experience</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                <span className="bg-gradient-to-r from-white via-red-200 to-red-400 bg-clip-text text-transparent">Event Live</span>
              </h2>
              <p className="text-base md:text-xl text-gray-300 max-w-2xl mx-auto mt-3">
                Sedang berlangsung, siap kamu nikmati malam ini.
              </p>
            </div>

            {/* Loading/Error States */}
            {isLoading && (
              <div className="text-center py-20">
                <div className="animate-spin w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-white text-lg">Memuat event live...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-6 rounded-xl text-center mb-8">
                <h3 className="font-bold mb-2">⚠️ Gagal memuat event</h3>
                <p>{error.message}</p>
              </div>
            )}

            {/* No Events State */}
            {!isLoading && !error && upcomingEvents.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-6">🎤</div>
                <h3 className="text-2xl font-bold text-white mb-4">Belum Ada Event Live</h3>
                <p className="text-gray-400 text-lg mb-8">Event spektakuler segera hadir. Stay tuned!</p>
                {session?.user?.role === "admin" && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                  >
                    ⚙️ Kelola Event
                  </Link>
                )}
              </div>
            )}

            {/* Events Grid */}
            {!isLoading && upcomingEvents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {upcomingEvents.map((event) => (
                 <div key={event._id} className="group bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-red-500/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/10">

                   {/* Event Header */}
                   <div className="relative bg-gradient-to-br from-red-900 via-black to-gray-900 p-6">
                     <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center opacity-20"></div>
                     <div className="relative">
                       <div className="flex items-center justify-between mb-4">
                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 backdrop-blur rounded-full text-red-200 text-xs font-medium">
                           🎵 LIVE
                         </div>
                         <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center">
                           <span className="text-white text-xl">🎤</span>
                         </div>
                       </div>

                       <h3 className="text-2xl font-bold text-white leading-tight mb-2">
                         <Link className="hover:text-red-200 transition-colors" href={`/events/${event._id}`}>
                           {event.name}
                         </Link>
                       </h3>

                       <div className="flex items-center gap-4 text-gray-300 text-sm">
                         <span className="flex items-center gap-1">
                           📍 {event.city}
                         </span>
                         <span className="flex items-center gap-1">
                           📅 <ClientDate value={event.date} />
                         </span>
                       </div>

                       {/* Quick badges */}
                       <div className="mt-3 flex flex-wrap gap-2">
                         <span className="text-xs px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-gray-200">Mulai dari <span className="font-bold text-white">Rp {event.minPrice.toLocaleString('id-ID')}</span></span>
                         <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-100">Kuota {event.totalQuota}</span>
                       </div>
                     </div>
                   </div>

                   {/* Event Info */}
                   <div className="p-6">
                     <p className="text-gray-300 leading-relaxed mb-6 line-clamp-3">
                       {event.description}
                     </p>

                     {/* Ticket Types Grid */}
                     <div className="grid grid-cols-2 gap-3 mb-6">
                       {event.ticketTypes.slice(0, 4).map((ticket) => (
                         <div key={ticket._id} className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-3 text-center">
                           <div className="text-xs font-medium text-gray-400 mb-1">{ticket.name}</div>
                           <div className="text-lg font-bold text-white">
                             Rp {ticket.price.toLocaleString('id-ID')}
                           </div>
                           <div className="text-xs text-green-400">{ticket.quota} tersisa</div>
                         </div>
                       ))}
                     </div>

                     {/* Action Button */}
                     <Link
                       href={`/events/${event._id}`}
                       className="block w-full text-center py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-600 transition-all duration-200 group-hover:scale-[1.02] shadow-lg group"
                     >
                       🎸 Beli Tiket Sekarang
                       <span className="ml-2 inline-block transition-transform group-hover:translate-x-2">→</span>
                     </Link>
                   </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
