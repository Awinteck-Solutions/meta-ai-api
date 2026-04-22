import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerPhone: { type: String, required: true },
    message: { type: String, required: true },
    response: { type: String, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ businessId: 1, customerPhone: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;

