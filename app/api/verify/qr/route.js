import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import { verifyQRSignature } from "@/lib/security/qr";

export async function POST(req) {
  try {
    console.log('[API-VERIFY] ========== VERIFICATION START ==========');
    
    const session = await getServerSession(authOptions);
    console.log('[API-VERIFY] Session check:', session?.user?.email ? 'VALID' : 'INVALID');
    
    if (!session?.user?.email) {
      console.log('[API-VERIFY] No session - returning 401');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    console.log('[API-VERIFY] Database connected');
    
    const user = await User.findOne({ email: session.user.email });
    console.log('[API-VERIFY] User lookup:', user?.email, 'Role:', user?.role);
    
    // Only admin/crew can verify tickets
    if (!user || user.role !== "admin") {
      console.log('[API-VERIFY] Access denied - not admin');
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { qrData, gateId, deviceId, crewId, scanTime } = body;
    console.log('[API-VERIFY] Request body received:', { 
      hasQrData: !!qrData, 
      qrDataType: typeof qrData,
      gateId, 
      deviceId, 
      crewId 
    });

    if (!qrData) {
      return NextResponse.json({ error: "QR data is required" }, { status: 400 });
    }

    // Parse QR data if it's a string
    let parsedQRData;
    try {
      parsedQRData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
      console.log('[API-VERIFY] QR data parsed successfully:', {
        orderId: parsedQRData?.orderId,
        eventId: parsedQRData?.eventId, 
        userId: parsedQRData?.userId,
        hasSignature: !!parsedQRData?.signature
      });
    } catch (error) {
      console.error('[API-VERIFY] QR parse error:', error);
      return NextResponse.json({ 
        valid: false, 
        error: "Invalid QR code format" 
      }, { status: 400 });
    }

    // Verify QR signature
    console.log('[API-VERIFY] Starting signature verification...');
    const verification = verifyQRSignature(parsedQRData);
    console.log('[API-VERIFY] Signature verification result:', verification);
    
    if (!verification.valid) {
      // Log failed verification
      const failedLog = {
        orderId: 'UNKNOWN',
        eventId: 'UNKNOWN', 
        crewEmail: session.user.email,
        crewId: crewId || session.user.email,
        gateId: gateId || 'UNKNOWN',
        deviceId: deviceId || 'UNKNOWN',
        scanTime: scanTime || new Date().toISOString(),
        verificationResult: 'INVALID',
        errorReason: verification.error,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[GATE-SCAN-FAILED] ${JSON.stringify(failedLog)}`);
      
      // Send to dashboard logs
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const logUrl = `${baseUrl}/api/admin/scan-logs`;
        console.log('[API-VERIFY] Sending failed scan log to:', logUrl);
        
        await fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(failedLog)
        });
        
        console.log('[API-VERIFY] Failed scan logged successfully');
      } catch (logError) {
        console.error('[API-VERIFY] Failed to log failed scan:', logError);
      }
      
      return NextResponse.json({
        valid: false,
        error: verification.error,
        timestamp: new Date().toISOString()
      });
    }

    // Additional database verification
    console.log('[API-VERIFY] Looking up order:', verification.payload.orderId);
    const order = await Order.findById(verification.payload.orderId)
      .populate('eventId')
      .populate('userId')
      .lean();

    console.log('[API-VERIFY] Order lookup result:', {
      found: !!order,
      orderId: order?._id,
      status: order?.status,
      eventName: order?.eventId?.name,
      customerEmail: order?.userId?.email
    });

    if (!order) {
      console.log('[API-VERIFY] Order not found in database');
      return NextResponse.json({
        valid: false,
        error: "Order not found in database"
      });
    }

    if (order.status !== "approved") {
      return NextResponse.json({
        valid: false,
        error: "Ticket is not approved"
      });
    }

    // Verify event and user match QR data
    if (String(order.eventId._id) !== verification.payload.eventId) {
      return NextResponse.json({
        valid: false,
        error: "Event ID mismatch"
      });
    }

    if (String(order.userId._id) !== verification.payload.userId) {
      return NextResponse.json({
        valid: false,
        error: "User ID mismatch"
      });
    }

    // PERBAIKAN: Duplicate scanning prevention untuk QR codes
    console.log('[QR-API] Checking for duplicate scans...');
    
    try {
      const scanLogsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/scan-logs`, {
        method: 'GET',
        headers: { 'X-Internal-Request': 'true' }
      });
      
      if (scanLogsResponse.ok) {
        const { logs } = await scanLogsResponse.json();
        console.log(`[QR-API] Retrieved ${logs.length} logs for duplicate check`);
        console.log(`[QR-API] Looking for orderId: ${String(order._id)}`);
        
        // DEBUG: Show first few logs to verify structure
        if (logs.length > 0) {
          console.log('[QR-API] Sample log structure:', JSON.stringify(logs[0], null, 2));
        }
        
        // Check if this order has been scanned before (within last 24 hours)
        const recentScans = logs.filter(log => {
          const orderMatch = log.orderId === String(order._id);
          const validResult = log.verificationResult === 'VALID';
          const recent = new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          console.log(`[QR-API] Checking log: orderId=${log.orderId}, match=${orderMatch}, valid=${validResult}, recent=${recent}`);
          
          return orderMatch && validResult && recent;
        });
        
        console.log(`[QR-API] Found ${recentScans.length} recent scans for this order`);
        
        if (recentScans.length > 0) {
          const lastScan = recentScans[0];
          console.log('[QR-API] ⚠️ Duplicate scan detected:', lastScan.timestamp);
          
          return NextResponse.json({
            valid: false,
            error: `Tiket sudah di-scan sebelumnya pada ${new Date(lastScan.timestamp).toLocaleString('id-ID')} oleh ${lastScan.crewEmail}`,
            lastScanInfo: {
              timestamp: lastScan.timestamp,
              scannedBy: lastScan.crewEmail,
              gateId: lastScan.gateId,
              scanMethod: lastScan.verificationMethod || 'QR'
            }
          });
        }
        
        console.log('[QR-API] ✅ No duplicate scan found, proceeding...');
      } else {
        console.error('[QR-API] Failed to get scan logs:', scanLogsResponse.status);
      }
    } catch (duplicateCheckError) {
      console.error('[QR-API] Error checking duplicates:', duplicateCheckError);
      // Continue anyway if duplicate check fails
    }

    // Log successful verification for audit with tracking data
    const auditLog = {
      orderId: order._id,
      eventId: order.eventId._id,
      eventName: order.eventId.name,
      crewEmail: session.user.email,
      crewId: crewId || session.user.email,
      gateId: gateId || 'UNKNOWN',
      deviceId: deviceId || 'UNKNOWN',
      scanTime: scanTime || new Date().toISOString(),
      verificationResult: 'VALID',
      customerEmail: order.userId.email,
      customerName: order.userId.name || order.userId.email,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[GATE-SCAN] ${JSON.stringify(auditLog)}`);
    
    // Send to dashboard logs (fire and forget)
    console.log('[API-VERIFY] Sending to dashboard logs...');
    console.log('[API-VERIFY] Audit log data:', auditLog);
    
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const logUrl = `${baseUrl}/api/admin/scan-logs`;
      console.log('[API-VERIFY] Posting to:', logUrl);
      
      const logResponse = await fetch(logUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true' // Konsisten dengan manual verification
        },
        body: JSON.stringify(auditLog)
      });
      
      console.log('[API-VERIFY] Dashboard log response:', logResponse.status);
      
      if (!logResponse.ok) {
        const errorText = await logResponse.text();
        console.error('[API-VERIFY] Dashboard log error:', errorText);
      } else {
        const logResult = await logResponse.json();
        console.log('[API-VERIFY] Dashboard log success:', logResult);
      }
    } catch (logError) {
      console.error('[API-VERIFY] Failed to send log to dashboard:', logError);
    }

    // Return success with ticket details
    console.log('[API-VERIFY] ✅ VERIFICATION SUCCESS - returning valid ticket');
    console.log('[API-VERIFY] ========== VERIFICATION END ==========');
    
    return NextResponse.json({
      valid: true,
      message: "Ticket is valid",
      ticket: {
        orderId: order._id,
        eventName: order.eventId.name,
        eventDate: order.eventId.date,
        eventVenue: order.eventId.venue,
        customerName: order.userId.name || order.userId.email,
        customerEmail: order.userId.email,
        ticketTypes: order.items.map(item => ({
          type: item.ticketTypeId?.name || 'Unknown',
          quantity: item.qty
        })),
        totalAmount: order.total,
        approvedAt: order.updatedAt,
        verifiedAt: scanTime || new Date().toISOString(),
        verifiedBy: session.user.email,
        gateInfo: {
          gateId: gateId || 'UNKNOWN',
          deviceId: deviceId || 'UNKNOWN',
          crewId: crewId || session.user.email
        }
      }
    });

  } catch (error) {
    console.error("QR verification error:", error);
    return NextResponse.json({ 
      valid: false,
      error: "Verification system error" 
    }, { status: 500 });
  }
}