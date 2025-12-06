import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Ambil semua order user dengan populate event dan ticket types
  const orders = await Order.find({ userId: user._id })
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
    event: order.eventId,
    items: order.items.map(item => ({
      ticketType: item.ticketTypeId,
      qty: item.qty
    }))
  }));

  return NextResponse.json({ orders: formattedOrders });
}