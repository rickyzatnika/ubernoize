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
      fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/scan-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failedLog)
      }).catch(err => console.error('Failed to log scan:', err));
      
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

    // Check if ticket has already been used (optional - if you track usage)
    // You could add a 'usedAt' field to Order model and check here

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
    fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/scan-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditLog)
    }).then(response => {
      console.log('[API-VERIFY] Dashboard log response:', response.status);
    }).catch(err => {
      console.error('[API-VERIFY] Failed to log scan:', err);
    });

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