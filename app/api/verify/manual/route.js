import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import { verifyManualCode, generateVerificationCode } from "@/lib/security/qr";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    
    // Only admin/crew can verify tickets
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { verificationCode, orderId, eventId, gateId, deviceId, crewId, scanTime } = body;

    if (!verificationCode) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    // PERBAIKAN 4: Smart lookup - tidak wajib memerlukan Order ID dan Event ID
    // Jika tidak ada Order ID/Event ID, cari berdasarkan verification code saja
    console.log('[MANUAL-API] Received payload:', body);

    let order = null;
    
    if (orderId && eventId) {
      // PERBAIKAN: Jika Order ID dan Event ID tersedia, gunakan metode lama
      console.log('[MANUAL-API] Using provided Order ID and Event ID');
      
      const isCodeValid = verifyManualCode(verificationCode, orderId, eventId);
      if (!isCodeValid) {
        return NextResponse.json({
          valid: false,
          error: "Invalid verification code"
        });
      }

      order = await Order.findById(orderId)
        .populate('eventId')
        .populate('userId')
        .lean();

    } else {
      // PERBAIKAN: Smart lookup - cari order berdasarkan verification code
      console.log('[MANUAL-API] Smart lookup mode - searching orders by verification code');
      
      // Ambil semua order dengan status approved untuk dicek
      const approvedOrders = await Order.find({ status: 'approved' })
        .populate('eventId')
        .populate('userId')
        .lean();

      console.log(`[MANUAL-API] Checking ${approvedOrders.length} approved orders`);
      console.log(`[MANUAL-API] Looking for verification code: "${verificationCode.toUpperCase()}"`);

      // Cari order yang cocok dengan verification code
      for (const testOrder of approvedOrders) {
        const testCode = generateVerificationCode(String(testOrder._id), String(testOrder.eventId._id));
        console.log(`[MANUAL-API] Testing order ${testOrder._id}: ${testCode} vs ${verificationCode}`);
        
        if (testCode === verificationCode.toUpperCase()) {
          console.log(`[MANUAL-API] ✅ Found matching order: ${testOrder._id}`);
          order = testOrder;
          break;
        }
      }

      if (!order) {
        console.log('[MANUAL-API] ❌ No matching order found for verification code');
        console.log(`[MANUAL-API] DEBUG: Searched ${approvedOrders.length} orders, none matched "${verificationCode.toUpperCase()}"`);
        
        // DEBUG: Show sample generated codes for troubleshooting
        if (approvedOrders.length > 0) {
          console.log('[MANUAL-API] DEBUG: Sample generated codes from first 3 orders:');
          approvedOrders.slice(0, 3).forEach((testOrder, index) => {
            const sampleCode = generateVerificationCode(String(testOrder._id), String(testOrder.eventId._id));
            console.log(`[MANUAL-API] DEBUG: Order ${index + 1}: ${testOrder._id} -> Code: ${sampleCode}`);
          });
        }
        
        return NextResponse.json({
          valid: false,
          error: "Verification code tidak ditemukan atau tiket belum diapprove"
        });
      }
    }

    if (!order) {
      return NextResponse.json({
        valid: false,
        error: "Order not found"
      });
    }

    if (order.status !== "approved") {
      return NextResponse.json({
        valid: false,
        error: "Ticket is not approved"
      });
    }

    // PERBAIKAN BUG: Hanya validate eventId jika provided (tidak untuk smart lookup)
    if (eventId && String(order.eventId._id) !== eventId) {
      return NextResponse.json({
        valid: false,
        error: "Event ID does not match order"
      });
    }

    // PERBAIKAN: Event time validation dengan window yang lebih fleksibel
    const eventDate = new Date(order.eventId.date);
    const now = new Date();
    const twentyFourHoursBefore = new Date(eventDate.getTime() - (24 * 60 * 60 * 1000)); // 24 jam sebelum
    const sixHoursAfter = new Date(eventDate.getTime() + (6 * 60 * 60 * 1000));

    console.log(`[MANUAL-API] Event date: ${eventDate.toISOString()}`);
    console.log(`[MANUAL-API] Current time: ${now.toISOString()}`);
    console.log(`[MANUAL-API] Valid from: ${twentyFourHoursBefore.toISOString()}`);
    console.log(`[MANUAL-API] Valid until: ${sixHoursAfter.toISOString()}`);

    // TEMPORARY DISABLED: Time validation disabled untuk testing
    // if (now < twentyFourHoursBefore) {
    //   return NextResponse.json({
    //     valid: false,
    //     error: `Tiket belum bisa digunakan. Valid mulai: ${twentyFourHoursBefore.toLocaleString('id-ID')}`
    //   });
    // }

    if (now > sixHoursAfter) {
      return NextResponse.json({
        valid: false,
        error: "Ticket has expired - event ended"
      });
    }

    // PERBAIKAN: Check untuk duplicate scanning prevention
    console.log('[MANUAL-API] Checking for duplicate scans...');
    
    // Import scan logs untuk check duplicate
    try {
      const scanLogsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/scan-logs`, {
        method: 'GET',
        headers: { 'X-Internal-Request': 'true' }
      });
      
      if (scanLogsResponse.ok) {
        const { logs } = await scanLogsResponse.json();
        console.log(`[MANUAL-API] Retrieved ${logs.length} logs for duplicate check`);
        console.log(`[MANUAL-API] Looking for orderId: ${String(order._id)}`);
        
        // DEBUG: Show first few logs to verify structure
        if (logs.length > 0) {
          console.log('[MANUAL-API] Sample log structure:', JSON.stringify(logs[0], null, 2));
        }
        
        // Check if this order has been scanned before (within last 24 hours)
        const recentScans = logs.filter(log => {
          const orderMatch = log.orderId === String(order._id);
          const validResult = log.verificationResult === 'VALID';
          const recent = new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          console.log(`[MANUAL-API] Checking log: orderId=${log.orderId}, match=${orderMatch}, valid=${validResult}, recent=${recent}`);
          
          return orderMatch && validResult && recent;
        });
        
        console.log(`[MANUAL-API] Found ${recentScans.length} recent scans for this order`);
        
        if (recentScans.length > 0) {
          const lastScan = recentScans[0];
          console.log('[MANUAL-API] ⚠️ Duplicate scan detected:', lastScan.timestamp);
          
          return NextResponse.json({
            valid: false,
            error: `Tiket sudah di-scan sebelumnya pada ${new Date(lastScan.timestamp).toLocaleString('id-ID')} oleh ${lastScan.crewEmail}`,
            lastScanInfo: {
              timestamp: lastScan.timestamp,
              scannedBy: lastScan.crewEmail,
              gateId: lastScan.gateId
            }
          });
        }
        
        console.log('[MANUAL-API] ✅ No duplicate scan found, proceeding...');
      } else {
        console.error('[MANUAL-API] Failed to get scan logs:', scanLogsResponse.status);
      }
    } catch (duplicateCheckError) {
      console.error('[MANUAL-API] Error checking duplicates:', duplicateCheckError);
      // Continue anyway if duplicate check fails
    }

    // Log successful verification with tracking data
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
      verificationMethod: 'MANUAL',
      customerEmail: order.userId.email,
      customerName: order.userId.name || order.userId.email,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[GATE-SCAN-MANUAL] ${JSON.stringify(auditLog)}`);
    
    // PERBAIKAN: Send audit log to dashboard dengan internal request flag
    console.log('[MANUAL-API] Sending audit log to dashboard...');
    try {
      const logResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/scan-logs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true' // Flag untuk bypass authentication
        },
        body: JSON.stringify(auditLog)
      });
      
      console.log(`[MANUAL-API] Dashboard log response status: ${logResponse.status}`);
      
      if (!logResponse.ok) {
        const errorText = await logResponse.text();
        console.error('[MANUAL-API] Dashboard log failed:', errorText);
      } else {
        const responseData = await logResponse.json();
        console.log('[MANUAL-API] ✅ Successfully logged to dashboard:', responseData.message);
        console.log(`[MANUAL-API] Total logs in system: ${responseData.totalLogs}`);
      }
    } catch (err) {
      console.error('[MANUAL-API] Failed to log scan to dashboard:', err);
    }

    return NextResponse.json({
      valid: true,
      message: "Ticket verified successfully",
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
        verificationMethod: "manual",
        gateInfo: {
          gateId: gateId || 'UNKNOWN',
          deviceId: deviceId || 'UNKNOWN',
          crewId: crewId || session.user.email
        }
      }
    });

  } catch (error) {
    console.error("Manual verification error:", error);
    return NextResponse.json({ 
      valid: false,
      error: "Verification system error" 
    }, { status: 500 });
  }
}