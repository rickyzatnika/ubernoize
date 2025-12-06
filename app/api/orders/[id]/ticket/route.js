import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";
import QRCode from "qrcode";
import { generateSecureQRData, generateVerificationCode } from "@/lib/security/qr";

export async function GET(_req, context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: orderId } = await context.params;
    
    // Get order with populated data
    const order = await Order.findOne({ _id: orderId, userId: user._id })
      .populate('eventId')
      .populate('items.ticketTypeId')
      .lean();
      
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "approved") {
      return NextResponse.json({ error: "Tiket hanya tersedia untuk order yang sudah disetujui" }, { status: 400 });
    }

    // Generate secure QR code data with digital signature
    const qrData = generateSecureQRData(order, user, order.eventId);
    
    // Generate backup verification code
    const verificationCode = generateVerificationCode(order._id, order.eventId._id);

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Return ticket data
    return NextResponse.json({
      ticket: {
        orderId: order._id,
        event: {
          name: order.eventId.name,
          city: order.eventId.city,
          date: order.eventId.date,
          venue: order.eventId.venue
        },
        user: {
          name: user.name || user.email,
          email: user.email
        },
        items: order.items.map(item => ({
          ticketType: item.ticketTypeId.name,
          qty: item.qty,
          price: item.ticketTypeId.price
        })),
        total: order.total,
        qrCode: qrCodeDataURL,
        verificationCode: verificationCode,
        securityInfo: {
          issuedAt: qrData.issuedAt,
          expiresAt: qrData.expiresAt,
          version: qrData.version
        },
        status: order.status,
        approvedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error("GET /api/orders/[id]/ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}