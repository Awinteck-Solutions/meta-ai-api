import { Request, Response } from "express";
import Contact from "../schema/contact.schema";

export class ContactController {
  static async create(req: Request, res: Response): Promise<void> {
    const record = await Contact.create(req.body);
    res.status(201).json({ success: true, message: "Contact request received", data: record });
  }
}
