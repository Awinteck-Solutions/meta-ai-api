import { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { env } from "../config/env";

export const authentification = (req: Request, res: Response, next: NextFunction): any => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decode = jwt.verify(token, env.jwtSecret) as { id: string; email: string; role?: string };
    if (!decode) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req['currentUser'] = decode;
  } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};