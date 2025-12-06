"use client";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url) => fetch(url).then((r) => r.json());

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800", 
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800"
};

const statusLabels = {
  pending: "Menunggu Pembayaran",
  paid: "Sudah Bayar", 
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan"
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [filter, setFilter] = useState("paid"); // Default show orders yang perlu direview
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [adminNote, setAdminNote] = useState("");

  const { data, error, isLoading, mutate } = useSWR(
    session?.user?.role === "admin" ? `/api/admin/orders?status=${filter}` : null,
    fetcher,
    { refreshInterval: 8000 }
  );

  if (status === "loading") {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <p>Memuat...</p>
      </div>
    );
  }

  if (!session || session.user?.role !== "admin") {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p>Halaman ini hanya untuk admin.</p>
        <p><a className="text-blue-600 underline" href="/signin">Sign In</a></p>
      </div>
    );
  }

  const handleReview = async (orderId, action) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote })
      });

      if (response.ok) {
        mutate(); // Refresh data
        setReviewingOrder(null);
        setAdminNote("");
        alert(`Order berhasil ${action === "approve" ? "disetujui" : "ditolak"}!`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      alert("Gagal melakukan review order");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">Kelola order dan review bukti pembayaran</p>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "paid", label: "Perlu Review" },
            { key: "all", label: "Semua" },
            { key: "pending", label: "Belum Bayar" },
            { key: "approved", label: "Disetujui" },
            { key: "rejected", label: "Ditolak" }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded text-sm font-medium ${
                filter === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="mb-8">
        {isLoading && <p>Memuat data order...</p>}
        {error && <p className="text-red-500">Gagal memuat data order.</p>}
        
        {data?.orders?.length === 0 && (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600">Tidak ada order dengan filter ini</p>
          </div>
        )}

        <div className="space-y-4">
          {data?.orders?.map((order) => (
            <div key={order._id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="font-semibold">{order.event?.name}</h3>
                  <p className="text-sm text-gray-600">
                    {order.event?.city} • {new Date(order.event?.date).toLocaleDateString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Order ID: {order._id.slice(-8)}
                  </p>
                  <p className="text-xs text-gray-500">
                    User: {order.user?.email}
                  </p>
                </div>

                <div>
                  <div className="mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <div className="text-sm">
                    {order.items?.map((item, idx) => (
                      <div key={idx}>
                        {item.ticketType?.name} x {item.qty}
                      </div>
                    ))}
                  </div>
                  <div className="font-semibold mt-1">
                    Total: Rp {order.total.toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {order.paymentProof && (
                    <div>
                      <a
                        href={order.paymentProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Lihat Bukti Pembayaran
                      </a>
                    </div>
                  )}
                  
                  {order.status === "paid" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReviewingOrder(order._id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Review
                      </button>
                    </div>
                  )}

                  {order.adminNote && (
                    <div className="text-xs text-gray-600">
                      <strong>Catatan:</strong> {order.adminNote}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Modal */}
      {reviewingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Review Order</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Catatan Admin (opsional)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full border rounded p-2 text-sm h-20"
                placeholder="Tambahkan catatan untuk user..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setReviewingOrder(null);
                  setAdminNote("");
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Batal
              </button>
              <button
                onClick={() => handleReview(reviewingOrder, "reject")}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Tolak
              </button>
              <button
                onClick={() => handleReview(reviewingOrder, "approve")}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Setujui
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <a className="text-blue-600 underline" href="/profile">
          Kembali ke Profile
        </a>
      </div>
    </div>
  );
}
