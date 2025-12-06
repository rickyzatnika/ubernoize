import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { eventId, items } = body || {};
  if (!eventId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ev = await Event.findById(eventId);
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Validate ticket types and compute total
  const typeIds = items.map((i) => i.ticketTypeId);
  const types = await TicketType.find({ _id: { $in: typeIds }, eventId });
  if (types.length !== typeIds.length) {
    return NextResponse.json({ error: "Invalid ticket type(s)" }, { status: 400 });
  }
  for (const it of items) {
    if (!Number.isInteger(it.qty) || it.qty < 1) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
  }
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  // Enforce user limit (3)
  const statuses = ["pending", "paid", "approved"]; // counted
  const existingOrders = await Order.find({ userId: user._id, status: { $in: statuses } }).lean();
  const existingCount = existingOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  if (existingCount + totalQty > 3) {
    return NextResponse.json({ error: "Limit 3 tiket per user terlampaui" }, { status: 400 });
  }

  const priceMap = Object.fromEntries(types.map((t) => [String(t._id), t.price]));
  const total = items.reduce((s, i) => s + priceMap[String(i.ticketTypeId)] * i.qty, 0);

  const order = await Order.create({
    userId: user._id,
    eventId,
    status: "pending",
    total,
    items: items.map((i) => ({ ticketTypeId: i.ticketTypeId, qty: i.qty })),
  });

  return NextResponse.json({ ok: true, orderId: order._id });
}
