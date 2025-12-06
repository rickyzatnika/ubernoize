import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import Order from "@/models/Order";

export async function POST(req, context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id: orderId } = await context.params;
  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action, adminNote } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ error: "Hanya order dengan status 'paid' yang dapat direview" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  
  await Order.findByIdAndUpdate(orderId, {
    status: newStatus,
    adminNote: adminNote || ""
  });

  return NextResponse.json({ 
    ok: true, 
    message: `Order berhasil ${action === "approve" ? "disetujui" : "ditolak"}`,
    newStatus
  });
}