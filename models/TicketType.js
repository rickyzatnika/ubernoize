import mongoose, { Schema } from "mongoose";

const TicketTypeSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", index: true, required: true },
    name: { type: String, enum: ["Bronze", "Silver", "Gold", "VIP"], required: true },
    price: { type: Number, required: true },
    quota: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.TicketType || mongoose.model("TicketType", TicketTypeSchema);
