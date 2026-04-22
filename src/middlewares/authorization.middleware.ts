import { NextFunction, Request, Response } from "express";
import { Status } from "../enums/status.enum";
import User from "../Features/auth/schema/user.schema";

export const authorization = (roles: string[]): any => {

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
    const currentUserId = req['currentUser']?.id;
    if (!currentUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(currentUserId); 
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (user.status !== Status.ACTIVE) {
      return res.status(403).json({ message: "Account not active" });
    }
    } catch (error) {
      return res.status(403).json({ message: "Denied (system error)" });
    }
    next();
  };
};