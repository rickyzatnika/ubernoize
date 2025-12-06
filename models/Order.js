import mongoose, { Schema } from "mongoose";

const OrderItemSchema = new Schema(
  {
    ticketTypeId: { type: Schema.Types.ObjectId, ref: "TicketType", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", index: true, required: true },
    status: { type: String, enum: ["pending", "paid", "approved", "rejected", "cancelled"], default: "pending", index: true },
    total: { type: Number, default: 0 },
    items: { type: [OrderItemSchema], default: [] },
    paymentProof: { type: String }, // URL/path ke file bukti pembayaran
    adminNote: { type: String }, // Catatan admin saat approve/reject
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
