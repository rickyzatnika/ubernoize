"use client";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";
import TicketModal from "@/app/components/TicketModal";

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

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [uploadingOrder, setUploadingOrder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewingTicket, setViewingTicket] = useState(null);

  const { data, error, isLoading, mutate } = useSWR(
    session ? "/api/orders/me" : null, 
    fetcher,
    { refreshInterval: 8000 }
  );

  const handleFileUpload = async (orderId) => {
    if (!selectedFile) {
      alert("Pilih file bukti pembayaran terlebih dahulu");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("paymentProof", selectedFile);

      const response = await fetch(`/api/orders/${orderId}/upload-proof`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        mutate(); // Refresh data
        setUploadingOrder(null);
        setSelectedFile(null);
        alert("Bukti pembayaran berhasil diupload!");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert("Gagal upload file");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Memuat...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold">Anda belum login</h1>
        <p><a className="text-blue-600 underline" href="/signin">Masuk di sini</a></p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Halo, {session.user?.name || session.user?.email}</h1>
        <p className="text-gray-600">Role: {session.user?.role}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Riwayat Pemesanan</h2>
        
        {isLoading && <p>Memuat riwayat order...</p>}
        {error && <p className="text-red-500">Gagal memuat riwayat order.</p>}
        
        {data?.orders?.length === 0 && (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600">Belum ada pemesanan</p>
            <a 
              href="/" 
              className="inline-block mt-2 text-blue-600 hover:underline"
            >
              Lihat Event Tersedia
            </a>
          </div>
        )}

        {data?.orders?.map((order) => (
          <div key={order._id} className="border rounded-lg p-4 mb-4 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">{order.event?.name}</h3>
                <p className="text-sm text-gray-600">
                  {order.event?.city} • {new Date(order.event?.date).toLocaleDateString('id-ID')}
                </p>
                <p className="text-xs text-gray-500">
                  Order ID: {order._id}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>

            <div className="mb-3">
              <h4 className="font-medium text-sm mb-2">Detail Tiket:</h4>
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span>{item.ticketType?.name} x {item.qty}</span>
                  <span>Rp {(item.ticketType?.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <div className="text-xs text-gray-500">
                Dipesan: {new Date(order.createdAt).toLocaleDateString('id-ID', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="font-semibold">
                Total: Rp {order.total.toLocaleString()}
              </div>
            </div>

            {/* Tombol upload bukti pembayaran untuk status pending */}
            {order.status === 'pending' && (
              <div className="mt-3 pt-3 border-t">
                <button 
                  onClick={() => setUploadingOrder(order._id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Upload Bukti Pembayaran
                </button>
              </div>
            )}

            {/* Tampilkan link bukti pembayaran untuk status paid */}
            {order.status === 'paid' && order.paymentProof && (
              <div className="mt-3 pt-3 border-t">
                <a 
                  href={order.paymentProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Lihat Bukti Pembayaran
                </a>
                <p className="text-xs text-gray-500 mt-1">Menunggu review admin</p>
              </div>
            )}

            {/* Tampilkan QR code untuk status approved */}
            {order.status === 'approved' && (
              <div className="mt-3 pt-3 border-t">
                <button 
                  onClick={() => setViewingTicket(order._id)}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                >
                  🎫 Lihat Tiket & QR Code
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <a className="text-blue-600 underline" href="/admin">
          {session.user?.role === 'admin' && 'Dashboard Admin'}
        </a>
      </div>

      {/* Upload Modal */}
      {uploadingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Upload Bukti Pembayaran</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Pilih File Bukti Pembayaran
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="w-full border rounded p-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: JPG, PNG, WebP. Maksimal 5MB
              </p>
            </div>

            {selectedFile && (
              <div className="mb-4 p-2 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">
                  File terpilih: {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  Ukuran: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setUploadingOrder(null);
                  setSelectedFile(null);
                }}
                disabled={uploading}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => handleFileUpload(uploadingOrder)}
                disabled={uploading || !selectedFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      <TicketModal 
        orderId={viewingTicket}
        isOpen={!!viewingTicket}
        onClose={() => setViewingTicket(null)}
      />
    </div>
  );
}
