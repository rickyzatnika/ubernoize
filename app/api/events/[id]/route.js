import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function GET(_req, context) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const ev = await Event.findById(id).lean();
    if (!ev) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const types = await TicketType.find({ eventId: id }).sort({ price: 1 }).lean();
    
    return NextResponse.json({
      event: {
        _id: ev._id,
        name: ev.name,
        city: ev.city,
        date: ev.date,
        venue: ev.venue,
        description: ev.description,
        ticketTypes: types.map((t) => ({ 
          _id: t._id, 
          name: t.name, 
          price: t.price, 
          quota: t.quota 
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
