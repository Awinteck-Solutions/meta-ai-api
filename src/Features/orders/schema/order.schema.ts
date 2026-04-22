import mongoose, { Schema } from "mongoose";

const orderItemSchema = new Schema(
  {
    catalogItemId: { type: Schema.Types.ObjectId, ref: "CatalogItem", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled", "completed"],
      default: "pending",
    },
    paymentReference: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

orderSchema.index({ businessId: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;

