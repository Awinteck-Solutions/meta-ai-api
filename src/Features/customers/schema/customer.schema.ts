import mongoose, { Schema } from "mongoose";

const customerSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    phone: { type: String, required: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;

