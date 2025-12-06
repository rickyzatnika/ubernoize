import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req, context) {
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
  const order = await Order.findOne({ _id: orderId, userId: user._id });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "pending") {
    return NextResponse.json({ error: "Hanya order dengan status pending yang dapat upload bukti pembayaran" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("paymentProof");

    if (!file) {
      return NextResponse.json({ error: "File bukti pembayaran diperlukan" }, { status: 400 });
    }

    // Validasi file type (hanya gambar)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format file tidak didukung. Gunakan JPG, PNG, atau WebP" }, { status: 400 });
    }

    // Validasi file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File terlalu besar. Maksimal 5MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop();
    const filename = `payment_proof_${orderId}_${timestamp}.${fileExtension}`;
    const filepath = path.join(process.cwd(), "public", "uploads", "payment-proofs", filename);

    // Create directory if it doesn't exist
    const fs = require("fs");
    const uploadDir = path.dirname(filepath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file
    await writeFile(filepath, buffer);

    // Update order status and payment proof path
    const paymentProofUrl = `/uploads/payment-proofs/${filename}`;
    await Order.findByIdAndUpdate(orderId, {
      paymentProof: paymentProofUrl,
      status: "paid"
    });

    return NextResponse.json({ 
      ok: true, 
      message: "Bukti pembayaran berhasil diupload",
      paymentProofUrl 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}