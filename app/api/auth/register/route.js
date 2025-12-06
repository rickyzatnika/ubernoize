import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    await connectToDatabase();
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name || email.split("@")[0],
      email,
      passwordHash,
      role: "user",
    });

    return NextResponse.json({ ok: true, userId: user._id });
  } catch (err) {
    console.error("Register error", err);
    return NextResponse.json({ error: "Gagal mendaftar" }, { status: 500 });
  }
}
