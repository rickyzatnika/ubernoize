import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import Order from "@/models/Order";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ count: 0, authenticated: false });
  await connectToDatabase();
  const userId = (await (await import("@/models/User")).default.findOne({ email: session.user.email }).select("_id"))._id;
  const statuses = ["pending", "paid", "approved"]; // dihitung untuk limit 3
  const orders = await Order.find({ userId, status: { $in: statuses } }).lean();
  const count = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  return NextResponse.json({ count, authenticated: true });
}
