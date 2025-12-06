"use client";
import useSWR from "swr";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ClientDate from "@/app/components/FormatDate";

const fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to fetch");
  }
  return r.json();
};

function formatCurrency(n) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function tierBadgeClasses(name = "") {
  const key = String(name).toLowerCase();
  if (key.includes("vip")) return "bg-purple-100 text-purple-800 border-purple-200";
  if (key.includes("gold")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (key.includes("silver")) return "bg-gray-100 text-gray-700 border-gray-200";
  if (key.includes("bronze")) return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function TierBadge({ name }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${tierBadgeClasses(name)}`}>
      <span aria-hidden>🎟️</span>
      {name}
    </span>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id;

  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR(() => (id ? `/api/events/${id}` : null), fetcher);
  const { data: limitData } = useSWR(`/api/orders/me/limit`, fetcher, { refreshInterval: 8000 });
  const [qtyMap, setQtyMap] = useState({});
  const event = data?.event;

  // Restore selection if coming back after login
  useEffect(() => {
    if (!id) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shouldResume = urlParams.get('resume') === '1';
      const raw = localStorage.getItem('resume_checkout');
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (shouldResume && stored?.eventId === id && stored?.qtyMap) {
        setQtyMap(stored.qtyMap);
        // clear stored resume data to avoid future unintended restores
        try { localStorage.removeItem('resume_checkout'); } catch {}
        // remove flag from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('resume');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [id]);

  const existingCount = limitData?.count || 0;
  const remaining = Math.max(0, 3 - existingCount);
  const selectedTotal = useMemo(
    () => Object.values(qtyMap).reduce((s, v) => s + (parseInt(v || 0, 10) || 0), 0),
    [qtyMap]
  );

  const grandTotal = useMemo(() => {
    if (!event?.ticketTypes) return 0;
    const priceMap = Object.fromEntries(event.ticketTypes.map(t => [t._id, t.price]));
    return Object.entries(qtyMap).reduce((sum, [id, q]) => sum + (priceMap[id] || 0) * (parseInt(q || 0, 10) || 0), 0);
  }, [event, qtyMap]);

  const canCheckout = selectedTotal > 0 && selectedTotal <= remaining;

  const setQuantity = useCallback((ticketTypeId, nextVal) => {
    const n = Math.max(0, Math.min(3, parseInt(nextVal || 0, 10) || 0));
    // Prevent exceeding remaining total
    const others = Object.entries(qtyMap).reduce((sum, [k, v]) => sum + (k === ticketTypeId ? 0 : (parseInt(v || 0, 10) || 0)), 0);
    const maxAllowedForThis = Math.min(3, Math.max(0, remaining - others));
    const final = Math.min(n, maxAllowedForThis);
    setQtyMap((prev) => ({ ...prev, [ticketTypeId]: final }));
  }, [qtyMap, remaining]);

  const inc = (ticketTypeId) => setQuantity(ticketTypeId, (qtyMap[ticketTypeId] || 0) + 1);
  const dec = (ticketTypeId) => setQuantity(ticketTypeId, (qtyMap[ticketTypeId] || 0) - 1);

  const onCheckout = async () => {
    if (!canCheckout) return;
    const items = Object.entries(qtyMap)
      .filter(([_, q]) => (q || 0) > 0)
      .map(([ticketTypeId, qty]) => ({ ticketTypeId, qty }));

    const attemptOrder = async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id, items })
      });
      return res;
    };

    const res = await attemptOrder();

    if (res.status === 401) {
      try {
        // Persist selection to localStorage
        const payload = { eventId: id, qtyMap, ts: Date.now() };
        localStorage.setItem('resume_checkout', JSON.stringify(payload));
      } catch {}
      // Redirect to signin with callback back to this detail page and a flag to resume
      const callbackUrl = encodeURIComponent(`/events/${id}?resume=1`);
      window.location.href = `/signin?callbackUrl=${callbackUrl}`;
      return;
    }

    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'Gagal membuat order');
      return;
    }
    alert('Order dibuat! Buka halaman profile untuk melihat status.');
    window.location.href = '/profile';
  };

  if (isLoading) return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="grid gap-3">
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
  if (error) return <div className="max-w-3xl mx-auto p-6 text-red-500">Gagal memuat event: {error.message}</div>;
  if (!event) return <div className="max-w-3xl mx-auto p-6">Event tidak ditemukan</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <a className="text-blue-600 hover:underline" href="/">← Kembali</a>
      <h1 className="text-3xl font-bold mt-2">{event.name}</h1>
      <p className="text-gray-600">{event.city} • <time dateTime={new Date(event.date).toISOString()}><ClientDate value={event.date} /></time> • {event.venue}</p>
      <p className="mt-4 text-gray-800">{event.description}</p>

      <div className="mt-6 flex items-center justify-between bg-gray-50 border rounded p-3">
        <p className="font-semibold">Sisa limit Anda: {remaining} dari 3</p>
        <p className="text-sm text-gray-600">Dipilih: {selectedTotal}</p>
      </div>

      <div className="mt-5 grid gap-3">
        {event.ticketTypes.map((t) => {
          const qty = qtyMap[t._id] || 0;
          const subtotal = t.price * qty;
          return (
            <div key={t._id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TierBadge name={t.name} />
                    <div className="text-base font-semibold">{t.name}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Rp {formatCurrency(t.price)} • Kuota {t.quota}</div>
                  {qty > 0 && (
                    <div className="text-sm text-gray-800 mt-1">Subtotal: Rp {formatCurrency(subtotal)}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => dec(t._id)}
                    disabled={qty <= 0}
                    className="h-9 w-9 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                    aria-label={`Kurangi ${t.name}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={qty}
                    onChange={(e) => setQuantity(t._id, e.target.value)}
                    className="w-14 text-center border rounded h-9"
                  />
                  <button
                    onClick={() => inc(t._id)}
                    disabled={selectedTotal >= remaining}
                    className="h-9 w-9 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                    aria-label={`Tambah ${t.name}`}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => inc(t._id)}
                  disabled={selectedTotal >= remaining}
                  className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                >
                  Beli 1
                </button>
                {t.quota <= 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">Sold Out</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between bg-gray-50 border rounded p-3">
        <div className="text-sm text-gray-700">Total tiket dipilih: <span className="font-semibold">{selectedTotal}</span></div>
        <div className="text-sm text-gray-700">Grand Total: <span className="font-semibold">Rp {formatCurrency(grandTotal)}</span></div>
      </div>

      <div className="mt-4">
        <button
          disabled={!canCheckout}
          onClick={onCheckout}
          className={`px-5 py-2.5 rounded ${canCheckout ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
        >
          Checkout
        </button>
      </div>
    </div>
  );
}
