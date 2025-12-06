"use client";
import Link from "next/link";
import useSWR from "swr";
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
  const { data, error, isLoading, mutate } = useSWR("/api/events", fetcher, { refreshInterval: 8000 });

  return (
    <div>
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bigBackground.png')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        
        <div className="relative max-w-6xl mx-auto px-6 py-32 text-white">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white text-sm font-medium mb-6">
              <span>🎵</span>
              Underground Music Experience
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                UBERNOIZE
              </span>
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-300">
                Underground
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-200 leading-relaxed mb-8 max-w-3xl">
              Rasakan pengalaman musik underground terbaik. Beli tiket dengan mudah, 
              <span className="text-white font-semibold"> tanpa antri panjang di gate.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="#events" 
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105"
              >
                🎸 Jelajahi Event
                <span className="ml-1">→</span>
              </Link>
              
              <Link 
                href="/profile" 
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200"
              >
                🎫 Tiket Saya
              </Link>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </section>

      <section id="events" className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Event Tersedia</h2>
        {isLoading && <p>Memuat...</p>}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
            Gagal memuat data: {error.message}
          </div>
        )}

        {!isLoading && !error && (data?.events?.length ?? 0) === 0 && (
          <div className="bg-gray-50 p-6 rounded text-center">
            <p className="text-gray-700">Belum ada event di database.</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/dev/seed", { method: "POST" });
                  await res.json();
                  mutate();
                } catch {}
              }}
              className="mt-3 inline-block px-4 py-2 rounded bg-black text-white hover:bg-gray-900"
            >
              Seed Demo Data
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.events?.map((ev) => (
            <div key={ev._id} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
              {/* Event Header */}
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-white text-xs font-medium mb-3">
                      <span>🎵</span>
                      Underground
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">
                      <Link className="hover:text-gray-200 transition-colors" href={`/events/${ev._id}`}>
                        {ev.name}
                      </Link>
                    </h3>
                  </div>
                </div>
                <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">🎤</span>
                </div>
              </div>

              {/* Event Info */}
              <div className="p-6">
                <div className="flex items-center gap-2 text-gray-600 text-sm mb-4">
                  <span className="inline-flex items-center gap-1">
                    📍 {ev.city}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    📅 <time dateTime={new Date(ev.date).toISOString()}><ClientDate value={ev.date} /></time>
                  </span>
                </div>
                
                <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-2">{ev.description}</p>
                
                {/* Ticket Types */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Jenis Tiket:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {ev.ticketTypes.slice(0, 4).map((t) => (
                      <div key={t._id} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="text-xs font-medium text-gray-600 mb-1">{t.name}</div>
                        <div className="text-sm font-bold text-gray-900">Rp {t.price.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{t.quota} tersedia</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <Link 
                  href={`/events/${ev._id}`} 
                  className="block w-full text-center py-3 px-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-semibold rounded-lg hover:from-gray-800 hover:to-gray-700 transition-all duration-200 group-hover:scale-[1.02] shadow-sm"
                >
                  Beli Tiket Sekarang
                  <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
