"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scanMode, setScanMode] = useState("camera"); // camera or manual
  const [manualCode, setManualCode] = useState("");
  const [orderId, setOrderId] = useState("");
  const [eventId, setEventId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [gateId, setGateId] = useState("GATE_A1");
  const [deviceId, setDeviceId] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Generate device ID on mount
  useEffect(() => {
    const savedDeviceId = localStorage.getItem("scanner_device_id");
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
    } else {
      const newDeviceId = `WEB_${Date.now().toString(36).toUpperCase()}`;
      localStorage.setItem("scanner_device_id", newDeviceId);
      setDeviceId(newDeviceId);
    }
  }, []);

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/signin");
    }
  }, [session, status, router]);

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        // Start scanning
        scanQRCode();
      }
    } catch (error) {
      console.error("Camera error:", error);
      alert("Tidak dapat mengakses kamera. Gunakan mode manual.");
      setScanMode("manual");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Try to decode QR code
    try {
      // This is a simplified approach - in production you'd use a QR library like jsQR
      // For now, we'll implement manual scanning
      setTimeout(() => {
        if (cameraActive) {
          scanQRCode();
        }
      }, 100);
    } catch (error) {
      // Continue scanning
      setTimeout(() => {
        if (cameraActive) {
          scanQRCode();
        }
      }, 100);
    }
  };

  const verifyQRCode = async (qrData) => {
    setVerifying(true);
    try {
      const response = await fetch("/api/verify/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrData,
          gateId,
          deviceId,
          crewId: session?.user?.email,
          scanTime: new Date().toISOString()
        })
      });

      const result = await response.json();
      setLastResult(result);
      
      // Visual/audio feedback
      if (result.valid) {
        // Success feedback
        navigator.vibrate && navigator.vibrate([100, 50, 100]);
      } else {
        // Error feedback
        navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 200]);
      }

    } catch (error) {
      setLastResult({
        valid: false,
        error: "Network error - check connection"
      });
    } finally {
      setVerifying(false);
    }
  };

  const verifyManualCode = async () => {
    if (!manualCode || !orderId || !eventId) {
      alert("Harap isi semua field untuk verifikasi manual");
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch("/api/verify/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationCode: manualCode,
          orderId,
          eventId,
          gateId,
          deviceId,
          crewId: session?.user?.email,
          scanTime: new Date().toISOString()
        })
      });

      const result = await response.json();
      setLastResult(result);

    } catch (error) {
      setLastResult({
        valid: false,
        error: "Network error - check connection"
      });
    } finally {
      setVerifying(false);
    }
  };

  const clearResult = () => {
    setLastResult(null);
    setManualCode("");
    setOrderId("");
    setEventId("");
  };

  // Show loading if checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized if not admin
  if (!session || session.user?.role !== "admin") {
    return null; // Redirect will happen
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">🎫 UBERNOIZE Scanner</h1>
            <div className="text-sm text-gray-300">
              {deviceId}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-300">
            Crew: {session?.user?.email}
          </div>
        </div>

        {/* Gate Selection */}
        <div className="p-4 border-b">
          <label className="block text-sm font-medium mb-2">Gate Location:</label>
          <select
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            <option value="GATE_A1">Gate A1 - Main Entrance</option>
            <option value="GATE_A2">Gate A2 - Side Entrance</option>
            <option value="GATE_B1">Gate B1 - VIP Entrance</option>
            <option value="GATE_B2">Gate B2 - Staff Entrance</option>
          </select>
        </div>

        {/* Scan Mode Toggle */}
        <div className="p-4 border-b">
          <div className="flex rounded-lg overflow-hidden border">
            <button
              onClick={() => {
                setScanMode("camera");
                clearResult();
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                scanMode === "camera"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              📷 Camera Scan
            </button>
            <button
              onClick={() => {
                setScanMode("manual");
                stopCamera();
                clearResult();
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                scanMode === "manual"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ⌨️ Manual Entry
            </button>
          </div>
        </div>

        {/* Camera Scan Mode */}
        {scanMode === "camera" && (
          <div className="p-4">
            <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg"></div>
              </div>

              {/* Camera controls */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-4">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    📷 Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    ⏹️ Stop Camera
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center">
              {cameraActive 
                ? "Arahkan kamera ke QR code tiket"
                : "Tekan tombol untuk mengaktifkan kamera"
              }
            </p>
          </div>
        )}

        {/* Manual Entry Mode */}
        {scanMode === "manual" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Verification Code:</label>
              <input
                type="text"
                placeholder="8-digit code (e.g. A1B2C3D4)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="w-full border rounded-lg p-3 font-mono tracking-wider text-center"
                maxLength={8}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Order ID:</label>
              <input
                type="text"
                placeholder="Order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full border rounded-lg p-3 font-mono text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Event ID:</label>
              <input
                type="text"
                placeholder="Event ID"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full border rounded-lg p-3 font-mono text-sm"
              />
            </div>

            <button
              onClick={verifyManualCode}
              disabled={verifying || !manualCode || !orderId || !eventId}
              className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? "Verifying..." : "🔍 Verify Ticket"}
            </button>
          </div>
        )}

        {/* Verification Result */}
        {lastResult && (
          <div className="p-4 border-t">
            <div className={`p-4 rounded-lg ${
              lastResult.valid 
                ? "bg-green-50 border border-green-200" 
                : "bg-red-50 border border-red-200"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl ${lastResult.valid ? "text-green-600" : "text-red-600"}`}>
                  {lastResult.valid ? "✅" : "❌"}
                </div>
                <div>
                  <div className={`font-bold ${lastResult.valid ? "text-green-800" : "text-red-800"}`}>
                    {lastResult.valid ? "VALID TICKET" : "INVALID TICKET"}
                  </div>
                  <div className={`text-sm ${lastResult.valid ? "text-green-600" : "text-red-600"}`}>
                    {lastResult.message || lastResult.error}
                  </div>
                </div>
              </div>

              {lastResult.valid && lastResult.ticket && (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Customer:</span>
                      <p className="text-gray-900">{lastResult.ticket.customerName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Event:</span>
                      <p className="text-gray-900">{lastResult.ticket.eventName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Tickets:</span>
                      {lastResult.ticket.ticketTypes?.map((tt, idx) => (
                        <p key={idx} className="text-gray-900">{tt.type} x{tt.quantity}</p>
                      ))}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total:</span>
                      <p className="text-gray-900 font-bold">Rp {lastResult.ticket.totalAmount?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={clearResult}
                className="w-full mt-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                📋 New Scan
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 text-center text-xs text-gray-500 border-t">
          <p>UBERNOIZE Gate Scanner v1.0</p>
          <p>Device: {deviceId} | Gate: {gateId}</p>
        </div>
      </div>
    </div>
  );
}