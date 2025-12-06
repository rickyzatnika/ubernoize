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
    const { qrData } = body;

    if (!qrData) {
      return NextResponse.json({ error: "QR data is required" }, { status: 400 });
    }

    // Parse QR data if it's a string
    let parsedQRData;
    try {
      parsedQRData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return NextResponse.json({ 
        valid: false, 
        error: "Invalid QR code format" 
      }, { status: 400 });
    }

    // Verify QR signature
    const verification = verifyQRSignature(parsedQRData);
    
    if (!verification.valid) {
      return NextResponse.json({
        valid: false,
        error: verification.error,
        timestamp: new Date().toISOString()
      });
    }

    // Additional database verification
    const order = await Order.findById(verification.payload.orderId)
      .populate('eventId')
      .populate('userId')
      .lean();

    if (!order) {
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

    // Log successful verification for audit
    console.log(`Ticket verified successfully: Order ${order._id} by crew ${session.user.email}`);

    // Return success with ticket details
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
        verifiedAt: new Date().toISOString(),
        verifiedBy: session.user.email
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