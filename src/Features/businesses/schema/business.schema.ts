import mongoose, { Schema } from "mongoose";

const whatsappSchema = new Schema(
  {
    phoneNumber: { type: String, default: null },
    phoneNumberId: { type: String, default: null, index: true },
    accessToken: { type: String, default: null },
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    industry: { type: String, default: null },
    businessType: {
      type: String,
      enum: ["physical", "service", "both"],
      required: true,
      default: "both",
    },
    address: { type: String, default: null },
    location: { type: String, default: null },
    website: { type: String, default: null },
    businessHours: { type: String, default: null },
    whatsapp: { type: whatsappSchema, default: {} },
    /** When true, use `paystackSecretKey` for Paystack API calls for this business (see payments service). */
    paystackOwnPaymentsEnabled: { type: Boolean, default: false },
    paystackSecretKey: { type: String, default: null },
    subscriptionPlan: {
      type: String,
      enum: ["free", "starter", "growth", "business"],
      default: "free",
    },
  },
  { timestamps: true }
);

businessSchema.index({ ownerId: 1 }, { unique: true });

const Business = mongoose.model("Business", businessSchema);

export default Business;

