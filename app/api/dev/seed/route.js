import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Event from "@/models/Event";
import TicketType from "@/models/TicketType";

export async function POST() {
  await connectToDatabase();

  // Seed users
  const adminEmail = "admin@ubernoize.local";
  const userEmail = "user@ubernoize.local";
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    await User.create({
      name: "Admin",
      email: adminEmail,
      role: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
    });
  }
  const user = await User.findOne({ email: userEmail });
  if (!user) {
    await User.create({
      name: "User",
      email: userEmail,
      role: "user",
      passwordHash: await bcrypt.hash("user123", 10),
    });
  }

  // Seed multiple events (Garut, Bandung, Yogyakarta) running at the same time
  const baseDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days from now
  const eventsToSeed = [
    {
      name: "UBERNOIZE UNDERGROUND NIGHT - Garut",
      city: "Garut",
      date: baseDate,
      venue: "Garut Dome",
      description: "Gelaran underground spesial di Kota Garut.",
    },
    {
      name: "UBERNOIZE UNDERGROUND NIGHT - Bandung",
      city: "Bandung",
      date: baseDate,
      venue: "Ujung Berung Venue",
      description: "Malam underground bersama komunitas Ujung Berung.",
    },
    {
      name: "UBERNOIZE UNDERGROUND NIGHT - Yogyakarta",
      city: "Yogyakarta",
      date: baseDate,
      venue: "Jogja Concert Hall",
      description: "Panggung underground panas di Kota Pelajar.",
    },
  ];

  for (const evData of eventsToSeed) {
    let ev = await Event.findOne({ name: evData.name });
    if (!ev) {
      ev = await Event.create(evData);
    }

    // Ensure ticket types exist for this event
    const existingTypes = await TicketType.find({ eventId: ev._id });
    if (existingTypes.length === 0) {
      await TicketType.insertMany([
        { eventId: ev._id, name: "Bronze", price: 50000, quota: 300 },
        { eventId: ev._id, name: "Silver", price: 100000, quota: 200 },
        { eventId: ev._id, name: "Gold", price: 150000, quota: 120 },
        { eventId: ev._id, name: "VIP", price: 250000, quota: 60 },
      ]);
    }
  }

  const countEvents = await Event.countDocuments({});
  const countTypes = await TicketType.countDocuments({});
  return NextResponse.json({ ok: true, message: "Seeded users + 3 events with ticket types", countEvents, countTypes });
}
