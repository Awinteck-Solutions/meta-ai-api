import mongoose, { Schema } from "mongoose";

const bookingSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "CatalogItem", required: true },
    bookingDate: { type: String, required: true },
    bookingTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "paid", "cancelled", "completed"],
      default: "pending",
    },
    paymentReference: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

bookingSchema.index({ businessId: 1, bookingDate: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;

