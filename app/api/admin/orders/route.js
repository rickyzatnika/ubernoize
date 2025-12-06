import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";

  // Build filter
  let filter = {};
  if (status !== "all") {
    filter.status = status;
  }

  // Ambil semua orders dengan populate user, event, dan ticket types
  const orders = await Order.find(filter)
    .populate({
      path: "userId",
      model: User,
      select: "email name"
    })
    .populate({
      path: "eventId",
      model: Event,
      select: "name city date venue"
    })
    .populate({
      path: "items.ticketTypeId",
      model: TicketType,
      select: "name price"
    })
    .sort({ createdAt: -1 }) // Terbaru dulu
    .lean();

  // Format response untuk UI
  const formattedOrders = orders.map(order => ({
    _id: order._id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paymentProof: order.paymentProof,
    adminNote: order.adminNote,
    user: order.userId,
    event: order.eventId,
    items: order.items.map(item => ({
      ticketType: item.ticketTypeId,
      qty: item.qty
    }))
  }));

  return NextResponse.json({ orders: formattedOrders });
}