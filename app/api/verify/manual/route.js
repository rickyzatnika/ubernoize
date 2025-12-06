import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import { verifyManualCode } from "@/lib/security/qr";

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
    const { verificationCode, orderId, eventId } = body;

    if (!verificationCode) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    if (!orderId || !eventId) {
      return NextResponse.json({ error: "Order ID and Event ID are required" }, { status: 400 });
    }

    // Verify the manual code
    const isCodeValid = verifyManualCode(verificationCode, orderId, eventId);

    if (!isCodeValid) {
      return NextResponse.json({
        valid: false,
        error: "Invalid verification code"
      });
    }

    // Get order details for additional verification
    const order = await Order.findById(orderId)
      .populate('eventId')
      .populate('userId')
      .lean();

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

    if (String(order.eventId._id) !== eventId) {
      return NextResponse.json({
        valid: false,
        error: "Event ID does not match order"
      });
    }

    // Check if event has started (allow entry 2 hours before event)
    const eventDate = new Date(order.eventId.date);
    const now = new Date();
    const twoHoursBefore = new Date(eventDate.getTime() - (2 * 60 * 60 * 1000));
    const sixHoursAfter = new Date(eventDate.getTime() + (6 * 60 * 60 * 1000));

    if (now < twoHoursBefore) {
      return NextResponse.json({
        valid: false,
        error: "Ticket not valid yet - event starts soon"
      });
    }

    if (now > sixHoursAfter) {
      return NextResponse.json({
        valid: false,
        error: "Ticket has expired - event ended"
      });
    }

    // Log successful verification
    console.log(`Manual verification successful: Order ${order._id} by crew ${session.user.email}`);

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
        verifiedAt: new Date().toISOString(),
        verifiedBy: session.user.email,
        verificationMethod: "manual"
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