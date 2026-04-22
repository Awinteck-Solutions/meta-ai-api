import mongoose, { Schema } from "mongoose";

const faqSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, default: "General" },
  },
  { timestamps: true }
);

faqSchema.index({ businessId: 1, createdAt: -1 });

const Faq = mongoose.model("Faq", faqSchema);
export default Faq;
