"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

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
  const [scanningStatus, setScanningStatus] = useState(""); // idle, scanning, found, error
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scanIntervalRef = useRef(null);

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
      console.log('[CAMERA] Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      console.log('[CAMERA] Camera access granted, stream:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[CAMERA] Video element found, setting up...');
        
        videoRef.current.addEventListener('loadedmetadata', () => {
          console.log('[CAMERA] Video metadata loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          videoRef.current.play();
          setCameraActive(true);
          setScanningStatus("scanning");
          // Start QR scanning after video is ready
          setTimeout(() => {
            console.log('[CAMERA] Starting QR scanning...');
            startScanning();
          }, 500);
        });
        
        videoRef.current.addEventListener('error', (e) => {
          console.error('[CAMERA] Video error:', e);
        });
      }
    } catch (error) {
      console.error("Camera error:", error);
      alert("Tidak dapat mengakses kamera. Gunakan mode manual.");
      setScanMode("manual");
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    setScanningStatus("");
    
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      console.log('[SCANNER] Scan skipped - missing refs or camera inactive');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    // Make sure video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log('[SCANNER] Video not ready, readyState:', video.readyState);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (canvas.width === 0 || canvas.height === 0) {
      console.log('[SCANNER] Invalid canvas dimensions:', canvas.width, 'x', canvas.height);
      return;
    }

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    try {
      // More aggressive QR detection with multiple strategies
      let qrCode = null;
      
      // Try multiple detection strategies for better responsiveness
      const strategies = [
        { inversionAttempts: "attemptBoth" },
        { inversionAttempts: "attemptBoth", debug: true },
        { inversionAttempts: "onlyInvert" },
        { inversionAttempts: "dontInvert" }
      ];
      
      for (const strategy of strategies) {
        qrCode = jsQR(imageData.data, imageData.width, imageData.height, strategy);
        if (qrCode) break;
      }

      if (qrCode) {
        console.log('[SCANNER] ✅ QR Code detected!');
        console.log('[SCANNER] QR Data:', qrCode.data);
        setScanningStatus("found");
        
        // Stop scanning temporarily to prevent multiple detections
        setCameraActive(false);
        
        // Process the QR code data immediately
        try {
          const qrData = JSON.parse(qrCode.data);
          console.log('[SCANNER] Valid JSON QR data:', qrData);
          verifyQRCode(qrData);
        } catch (parseError) {
          console.log('[SCANNER] Non-JSON QR data, treating as text:', qrCode.data);
          
          // For simple text QR codes, show detected message
          setLastResult({
            valid: true,
            message: `QR Code Detected: ${qrCode.data}`,
            ticket: {
              customerName: "QR Content",
              eventName: qrCode.data.substring(0, 50),
              ticketTypes: [{type: "Text QR", quantity: 1}],
              totalAmount: 0
            }
          });
          
          // Resume scanning after 3 seconds
          setTimeout(() => {
            setCameraActive(true);
            setScanningStatus("scanning");
            startScanning();
          }, 3000);
        }
      } else {
        // No QR code found - keep scanning
        setScanningStatus("scanning");
      }
    } catch (error) {
      console.error('[SCANNER] QR detection error:', error);
      setScanningStatus("error");
    }
  };

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    console.log('[SCANNER] Starting aggressive continuous scan...');
    setScanningStatus("scanning");
    
    // More aggressive scanning with both requestAnimationFrame AND interval
    const aggressiveScan = () => {
      if (cameraActive && videoRef.current && canvasRef.current) {
        scanQRCode();
        if (cameraActive) {
          requestAnimationFrame(aggressiveScan);
        }
      }
    };
    
    // Additional interval-based scanning for redundancy
    scanIntervalRef.current = setInterval(() => {
      if (cameraActive) {
        scanQRCode();
      }
    }, 50); // Very frequent scanning every 50ms
    
    // Start both scanning methods
    requestAnimationFrame(aggressiveScan);
  };


  // Capture function for debugging
  const handleCapture = () => {
    console.log('[CAPTURE] Button clicked!');
    
    if (!videoRef.current || !canvasRef.current) {
      console.log('[CAPTURE] Missing refs - video:', !!videoRef.current, 'canvas:', !!canvasRef.current);
      alert('Missing video or canvas reference');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext("2d");
      
      console.log('[CAPTURE] Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      console.log('[CAPTURE] Video ready state:', video.readyState);
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('[CAPTURE] Video has no dimensions');
        alert('Video not ready - dimensions are 0');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      console.log('[CAPTURE] Canvas updated with dimensions:', canvas.width, 'x', canvas.height);
      
      // Get image data for QR detection
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      console.log('[CAPTURE] Image data length:', imageData.data.length);
      
      // Try to detect QR with different settings
      let qrFound = false;
      const detectionSettings = [
        { inversionAttempts: "dontInvert" },
        { inversionAttempts: "onlyInvert" },
        { inversionAttempts: "attemptBoth" },
        { inversionAttempts: "attemptBoth", debug: true }
      ];
      
      console.log('[CAPTURE] Trying different QR detection settings...');
      
      for (let i = 0; i < detectionSettings.length && !qrFound; i++) {
        try {
          const settings = detectionSettings[i];
          console.log(`[CAPTURE] Attempt ${i + 1} with settings:`, settings);
          
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, settings);
          
          if (qrCode) {
            console.log(`[CAPTURE] SUCCESS on attempt ${i + 1}! ✅`);
            console.log('[CAPTURE] QR Data:', qrCode.data);
            console.log('[CAPTURE] QR Location:', qrCode.location);
            
            // Process the captured QR immediately
            try {
              const qrData = JSON.parse(qrCode.data);
              alert(`QR Code Found! (Attempt ${i + 1})\nProcessing verification...`);
              verifyQRCode(qrData);
            } catch (parseError) {
              alert(`QR Code Found! (Attempt ${i + 1})\nData: ${qrCode.data.substring(0, 100)}...`);
            }
            qrFound = true;
            break;
          } else {
            console.log(`[CAPTURE] Attempt ${i + 1}: NOT FOUND`);
          }
        } catch (qrError) {
          console.error(`[CAPTURE] Attempt ${i + 1} error:`, qrError);
        }
      }
      
      if (!qrFound) {
        alert(`No QR code detected after 4 attempts.\nTry:\n1. Better lighting\n2. Hold QR code closer/farther\n3. Reduce reflection/glare`);
      }
      
    } catch (error) {
      console.error('[CAPTURE] Capture error:', error);
      alert('Capture failed: ' + error.message);
    }
  };

  const verifyQRCode = async (qrData) => {
    console.log('[VERIFY] Starting verification process...');
    console.log('[VERIFY] QR Data to verify:', qrData);
    console.log('[VERIFY] Gate ID:', gateId);
    console.log('[VERIFY] Device ID:', deviceId);
    console.log('[VERIFY] Crew ID:', session?.user?.email);
    
    setVerifying(true);
    try {
      const payload = {
        qrData,
        gateId,
        deviceId,
        crewId: session?.user?.email,
        scanTime: new Date().toISOString()
      };
      
      console.log('[VERIFY] Sending payload:', payload);
      
      const response = await fetch("/api/verify/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log('[VERIFY] Response status:', response.status);
      console.log('[VERIFY] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VERIFY] API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[VERIFY] API Result:', result);
      setLastResult(result);
      
      // Visual/audio feedback
      if (result.valid) {
        console.log('[VERIFY] ✅ Verification successful!');
        navigator.vibrate && navigator.vibrate([100, 50, 100]);
        
        // Resume scanning after 5 seconds
        setTimeout(() => {
          console.log('[VERIFY] Resuming scanning...');
          setCameraActive(true);
          setScanningStatus("scanning");
          startScanning();
        }, 5000);
      } else {
        console.log('[VERIFY] ❌ Verification failed:', result.error);
        navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 200]);
        
        // Resume scanning after 3 seconds
        setTimeout(() => {
          console.log('[VERIFY] Resuming scanning after error...');
          setCameraActive(true);
          setScanningStatus("scanning");
          startScanning();
        }, 3000);
      }

    } catch (error) {
      console.error('[VERIFY] Network/Parse Error:', error);
      setLastResult({
        valid: false,
        error: `Verification failed: ${error.message}`
      });
      
      // Resume scanning after network error
      setTimeout(() => {
        setCameraActive(true);
        setScanningStatus("scanning");
        startScanning();
      }, 3000);
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
                <div className={`w-48 h-48 border-2 border-dashed rounded-lg transition-colors ${
                  scanningStatus === "found" ? "border-green-400" :
                  scanningStatus === "error" ? "border-red-400" :
                  scanningStatus === "scanning" ? "border-blue-400 animate-pulse" :
                  "border-white"
                }`}>
                  {/* Scanning corners */}
                  <div className="relative w-full h-full">
                    <div className={`absolute top-0 left-0 w-6 h-6 border-l-4 border-t-4 ${
                      scanningStatus === "found" ? "border-green-400" :
                      scanningStatus === "error" ? "border-red-400" :
                      "border-white"
                    }`}></div>
                    <div className={`absolute top-0 right-0 w-6 h-6 border-r-4 border-t-4 ${
                      scanningStatus === "found" ? "border-green-400" :
                      scanningStatus === "error" ? "border-red-400" :
                      "border-white"
                    }`}></div>
                    <div className={`absolute bottom-0 left-0 w-6 h-6 border-l-4 border-b-4 ${
                      scanningStatus === "found" ? "border-green-400" :
                      scanningStatus === "error" ? "border-red-400" :
                      "border-white"
                    }`}></div>
                    <div className={`absolute bottom-0 right-0 w-6 h-6 border-r-4 border-b-4 ${
                      scanningStatus === "found" ? "border-green-400" :
                      scanningStatus === "error" ? "border-red-400" :
                      "border-white"
                    }`}></div>
                    
                    {/* Status text */}
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                        {scanningStatus === "scanning" && "🔍 Scanning..."}
                        {scanningStatus === "found" && "✅ QR Found!"}
                        {scanningStatus === "error" && "❌ Error"}
                        {!scanningStatus && "📱 Position QR Code"}
                      </span>
                    </div>
                    
                  </div>
                </div>
              </div>

              {/* Camera controls */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    📷 Start Camera
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      ⏹️ Stop Camera
                    </button>
                    <button
                      onClick={handleCapture}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      📸 Capture
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-gray-600">
                {cameraActive 
                  ? "Arahkan kamera ke QR code tiket"
                  : "Tekan tombol untuk mengaktifkan kamera"
                }
              </p>
              <div className="text-xs text-gray-500">
                Tips: Posisikan QR code dengan jelas, jarak 15-30cm
              </div>
              
              {/* Test logging button */}
              <button
                onClick={async () => {
                  console.log('[TEST-LOG] Testing manual log to dashboard...');
                  try {
                    const testLog = {
                      orderId: "TEST-" + Date.now(),
                      eventId: "TEST-EVENT",
                      eventName: "Test Event dari Scanner",
                      crewEmail: session?.user?.email,
                      crewId: session?.user?.email,
                      gateId: gateId,
                      deviceId: deviceId,
                      scanTime: new Date().toISOString(),
                      verificationResult: 'VALID',
                      customerEmail: 'test@customer.com',
                      customerName: 'Test Customer',
                      timestamp: new Date().toISOString()
                    };
                    
                    const response = await fetch('/api/admin/scan-logs', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(testLog)
                    });
                    
                    console.log('[TEST-LOG] Response status:', response.status);
                    const result = await response.json();
                    console.log('[TEST-LOG] Response:', result);
                    
                    alert(`Test log result: ${response.ok ? 'SUCCESS' : 'FAILED'}\nCheck admin dashboard!`);
                  } catch (error) {
                    console.error('[TEST-LOG] Error:', error);
                    alert('Test log failed: ' + error.message);
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                🧪 Test Log to Dashboard
              </button>
            </div>
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
            <div className={`p-6 rounded-lg ${
              lastResult.valid 
                ? "bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300" 
                : "bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300"
            }`}>
              {/* Large Visual Indicator */}
              <div className="text-center mb-4">
                <div className={`text-8xl mb-2 ${lastResult.valid ? "text-green-500" : "text-red-500"}`}>
                  {lastResult.valid ? "✅" : "❌"}
                </div>
                <div className={`text-2xl font-black uppercase tracking-wide ${
                  lastResult.valid ? "text-green-800" : "text-red-800"
                }`}>
                  {lastResult.valid ? "🎫 TIKET VALID" : "⚠️ TIKET TIDAK VALID"}
                </div>
                <div className={`text-lg font-semibold mt-2 ${
                  lastResult.valid ? "text-green-700" : "text-red-700"
                }`}>
                  {lastResult.valid ? "BOLEH MASUK" : "AKSES DITOLAK"}
                </div>
              </div>

              {/* Security Status */}
              <div className={`text-center p-3 rounded-lg mb-4 ${
                lastResult.valid 
                  ? "bg-green-200 text-green-900"
                  : "bg-red-200 text-red-900"
              }`}>
                <div className="font-bold">
                  {lastResult.valid 
                    ? "🔒 TIKET ASLI TERVERIFIKASI - Signature Digital Valid"
                    : "⚠️ TIKET PALSU ATAU TIDAK VALID"
                  }
                </div>
                <div className="text-sm mt-1">
                  {lastResult.valid
                    ? "Tiket ini memiliki tanda tangan digital yang sah"
                    : lastResult.message || lastResult.error
                  }
                </div>
              </div>

              {lastResult.valid && lastResult.ticket && (
                <div className="bg-white p-4 rounded-lg space-y-3 text-sm border border-green-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-gray-700">Customer:</span>
                      <p className="text-gray-900 font-medium">{lastResult.ticket.customerName}</p>
                    </div>
                    <div>
                      <span className="font-bold text-gray-700">Event:</span>
                      <p className="text-gray-900 font-medium">{lastResult.ticket.eventName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-gray-700">Tiket:</span>
                      {lastResult.ticket.ticketTypes?.map((tt, idx) => (
                        <p key={idx} className="text-gray-900 font-medium">{tt.type} x{tt.quantity}</p>
                      ))}
                    </div>
                    <div>
                      <span className="font-bold text-gray-700">Total Bayar:</span>
                      <p className="text-gray-900 font-bold text-lg">Rp {lastResult.ticket.totalAmount?.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* Verification Details */}
                  <div className="border-t pt-3 mt-3">
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Verified At:</span>
                        <p>{lastResult.ticket.verifiedAt ? new Date(lastResult.ticket.verifiedAt).toLocaleString('id-ID') : 'Just now'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Gate:</span>
                        <p>{lastResult.ticket.gateInfo?.gateId || gateId}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={clearResult}
                className={`w-full mt-6 py-3 font-bold rounded-lg transition ${
                  lastResult.valid
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                📋 SCAN TIKET BERIKUTNYA
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