import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req, context) {
  try {
    console.log('[UPLOAD-DEBUG] Starting upload process...');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('[UPLOAD-DEBUG] No session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log('[UPLOAD-DEBUG] Session found:', session.user.email);

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('[UPLOAD-DEBUG] User not found');
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log('[UPLOAD-DEBUG] User found:', user._id);

    const { id: orderId } = await context.params;
    console.log('[UPLOAD-DEBUG] Order ID:', orderId);
    const order = await Order.findOne({ _id: orderId, userId: user._id });
    if (!order) {
      console.log('[UPLOAD-DEBUG] Order not found for user');
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    console.log('[UPLOAD-DEBUG] Order found:', order._id, 'Status:', order.status);

    if (order.status !== "pending") {
      console.log('[UPLOAD-DEBUG] Order status not pending:', order.status);
      return NextResponse.json({ error: "Hanya order dengan status pending yang dapat upload bukti pembayaran" }, { status: 400 });
    }
    console.log('[UPLOAD-DEBUG] Processing form data...');
    const formData = await req.formData();
    const file = formData.get("paymentProof");
    console.log('[UPLOAD-DEBUG] File received:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'No file');

    if (!file) {
      console.log('[UPLOAD-DEBUG] No file in form data');
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
    const fileExtension = file.name.split(".").pop() || 'jpg';
    const filename = `payment_proof_${orderId}_${timestamp}.${fileExtension}`;
    const filepath = path.join(process.cwd(), "public", "uploads", "payment-proofs", filename);
    console.log('[UPLOAD-DEBUG] File path:', filepath);

    // Create directory if it doesn't exist
    const fs = require("fs");
    const uploadDir = path.dirname(filepath);
    console.log('[UPLOAD-DEBUG] Upload directory:', uploadDir);
    
    if (!fs.existsSync(uploadDir)) {
      console.log('[UPLOAD-DEBUG] Creating directory...');
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file - try local first, fallback to base64 for serverless
    let paymentProofUrl;
    
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
      // Vercel deployment - store as base64 in database (temporary solution)
      console.log('[UPLOAD-DEBUG] Production/Vercel - storing as base64...');
      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'image/jpeg';
      paymentProofUrl = `data:${mimeType};base64,${base64}`;
      console.log('[UPLOAD-DEBUG] Base64 stored (length:', base64.length, ')');
    } else {
      // Local development - save to file system
      console.log('[UPLOAD-DEBUG] Writing file to filesystem...');
      try {
        await writeFile(filepath, buffer);
        paymentProofUrl = `/uploads/payment-proofs/${filename}`;
        console.log('[UPLOAD-DEBUG] File saved successfully to:', filepath);
      } catch (fileError) {
        console.error('[UPLOAD-DEBUG] File write failed, falling back to base64:', fileError);
        // Fallback to base64 if file write fails
        const base64 = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        paymentProofUrl = `data:${mimeType};base64,${base64}`;
      }
    }

    // Update order status and payment proof path
    console.log('[UPLOAD-DEBUG] Updating order in database...');
    await Order.findByIdAndUpdate(orderId, {
      paymentProof: paymentProofUrl,
      status: "paid"
    });
    console.log('[UPLOAD-DEBUG] Order updated successfully');

    return NextResponse.json({ 
      ok: true, 
      message: "Bukti pembayaran berhasil diupload",
      paymentProofUrl 
    });

  } catch (uploadError) {
    console.error("[UPLOAD-ERROR] Upload process failed:", uploadError);
    console.error("[UPLOAD-ERROR] Stack trace:", uploadError.stack);
    return NextResponse.json({ 
      error: `Gagal upload file: ${uploadError.message}`,
      details: process.env.NODE_ENV === 'development' ? uploadError.stack : undefined
    }, { status: 500 });
  }
}