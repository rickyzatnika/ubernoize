"use client";
import { useState, useEffect } from "react";

export default function TicketModal({ orderId, isOpen, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && orderId) {
      fetchTicket();
    }
  }, [isOpen, orderId]);

  const fetchTicket = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/ticket`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat tiket");
      }
      
      setTicket(data.ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!ticket) return;
    
    // Create downloadable image of the ticket
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 600;
    
    // Draw ticket background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add ticket content (simplified)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(ticket.event.name, 20, 40);
    
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${ticket.orderId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">🎫 Tiket Digital</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat tiket...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-500 text-4xl mb-4">❌</div>
              <p className="text-red-600 font-medium">{error}</p>
              <button 
                onClick={fetchTicket}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {ticket && (
            <div className="space-y-6">
              {/* Ticket Design */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
                
                <div className="relative">
                  {/* Event Info */}
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-medium mb-3">
                      🎵 Underground Event
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{ticket.event.name}</h3>
                    <div className="space-y-1 text-sm text-gray-300">
                      <p>📍 {ticket.event.city} • {ticket.event.venue}</p>
                      <p>📅 {new Date(ticket.event.date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="border-t border-white/20 pt-4 mb-4">
                    <p className="text-sm text-gray-300">Atas nama:</p>
                    <p className="font-semibold">{ticket.user.name}</p>
                  </div>

                  {/* Verification Code */}
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Kode Verifikasi</p>
                    <p className="text-lg font-mono font-bold tracking-wider bg-white/10 rounded-lg py-2 px-4 inline-block">
                      {ticket.verificationCode}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800">Detail Tiket:</h4>
                {ticket.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.ticketType}</p>
                      <p className="text-sm text-gray-600">Quantity: {item.qty}</p>
                    </div>
                    <p className="font-semibold">Rp {(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex justify-between items-center py-3 px-4 bg-gray-900 text-white rounded-lg font-bold">
                  <p>Total</p>
                  <p>Rp {ticket.total.toLocaleString()}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center space-y-4">
                <h4 className="font-semibold text-gray-800">QR Code untuk Gate</h4>
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-gray-200 rounded-xl">
                    <img 
                      src={ticket.qrCode} 
                      alt="QR Code Tiket"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-600 max-w-sm mx-auto">
                  Tunjukkan QR code ini kepada crew gate saat masuk event
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  🖨️ Print Tiket
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  💾 Download
                </button>
              </div>

              {/* Security Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">🔒</span>
                  <span className="font-medium text-gray-800">Tiket Terverifikasi Digital</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <p>Issued: {ticket.securityInfo ? new Date(ticket.securityInfo.issuedAt).toLocaleString('id-ID') : 'N/A'}</p>
                    <p>Expires: {ticket.securityInfo ? new Date(ticket.securityInfo.expiresAt).toLocaleString('id-ID') : 'N/A'}</p>
                  </div>
                  <div>
                    <p>Version: {ticket.securityInfo?.version || 'N/A'}</p>
                    <p>Secured: HMAC-SHA256</p>
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="text-center pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Tiket disetujui pada: {new Date(ticket.approvedAt).toLocaleDateString('id-ID')}
                </p>
                <p className="text-xs text-gray-500">
                  Order ID: {ticket.orderId}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  ⚠️ Tiket ini memiliki signature digital. Tidak dapat dipalsukan atau diduplikasi.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}