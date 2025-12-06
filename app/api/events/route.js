import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function GET() {
  try {
    await connectToDatabase();
    const events = await Event.find({}).sort({ date: 1 }).lean();
    const eventIds = events.map((e) => e._id);
    const types = await TicketType.find({ eventId: { $in: eventIds } }).lean();
    const map = {};
    for (const t of types) {
      const k = String(t.eventId);
      if (!map[k]) map[k] = [];
      map[k].push({ _id: t._id, name: t.name, price: t.price, quota: t.quota });
    }
    const payload = events.map((e) => ({
      _id: e._id,
      name: e.name,
      city: e.city,
      date: e.date,
      venue: e.venue,
      description: e.description,
      ticketTypes: map[String(e._id)] || [],
    }));
    return NextResponse.json({ events: payload });
  } catch (err) {
    console.error("/api/events error", err);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
