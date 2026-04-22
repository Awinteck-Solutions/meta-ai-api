import { NextFunction, Request, Response } from "express";
import Business from "../Features/businesses/schema/business.schema";

export const attachBusinessContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.currentUser?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const business = await Business.findOne({ ownerId }).lean();
    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found for authenticated user",
      });
      return;
    }

    req.businessId = String(business._id);
    next();
  } catch (error) {
    next(error);
  }
};

