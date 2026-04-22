import mongoose, { Schema } from "mongoose";

const catalogSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    type: { type: String, enum: ["product", "service"], required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: null, min: 0 },
    durationMinutes: { type: Number, default: null, min: 0 },
    images: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

catalogSchema.index({ businessId: 1, name: 1 });

const CatalogItem = mongoose.model("CatalogItem", catalogSchema);

export default CatalogItem;

