import { Request, Response } from "express";
import { instanceToPlain } from "class-transformer";
import multer from "multer";
import User from "../schema/user.schema";
import { encrypt } from "../../../helpers/tokenizer";
import type { UpdateUserProfileDto } from "../dto/update-user-profile.dto";
import type { UpdateNotificationPreferencesDto } from "../dto/update-notification-preferences.dto";

interface MulterRequest extends Request {
  file?: multer.File;
}

const PUBLIC_FIELDS = "-password -otp";

const PROFILE_PATCH_KEYS = [
  "firstname",
  "lastname",
  "phoneNumber",
  "image",
  "notificationEmail",
  "notificationPush",
  "notificationWeekly",
] as const;

function stripSensitive(user: Record<string, unknown> | null | undefined) {
  if (!user) return null;
  const { password: _p, otp: _o, ...rest } = user as Record<string, unknown>;
  return rest;
}

function formatNotificationPrefs(user: Record<string, unknown> | null | undefined) {
  if (!user) {
    return { email: true, push: false, weekly: true };
  }
  return {
    email: user.notificationEmail !== false,
    push: Boolean(user.notificationPush),
    weekly: user.notificationWeekly !== false,
  };
}

export class UserController {
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await User.deleteOne({ _id: id });
      return res.status(201).json({
        success: true,
        message: "User delete success",
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getAllUsers(req: Request, res: Response) {
    try {
      await User.find();
      return res.status(200).json({
        success: true,
        message: "User success",
        data: [],
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getOneUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const response = await User.findOne({ _id: id }).select(PUBLIC_FIELDS).lean();
      if (!response) {
        return res.status(404).json({ success: false, message: "User failed" });
      }
      return res.status(200).json({
        success: true,
        message: "User success",
        data: response,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async updateUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const response = await User.findOneAndUpdate({ _id: id }, { $set: status }, { new: true, runValidators: true })
        .select(PUBLIC_FIELDS)
        .lean();
      return res.status(200).json({
        success: true,
        message: "User success",
        data: response,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async profile(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"] as { id: string };
      const user = await User.findById(id).select(PUBLIC_FIELDS).lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.status(200).json({
        success: true,
        message: "Profile",
        data: user,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getNotificationPreferences(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"] as { id: string };
      const user = await User.findById(id).select("notificationEmail notificationPush notificationWeekly").lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.status(200).json({
        success: true,
        data: formatNotificationPrefs(user as Record<string, unknown>),
      });
    } catch {
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  static async updateNotificationPreferences(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"] as { id: string };
      const plain = instanceToPlain(req.body as UpdateNotificationPreferencesDto) as {
        email?: boolean;
        push?: boolean;
        weekly?: boolean;
      };
      const $set: Record<string, unknown> = {};
      if (typeof plain.email === "boolean") $set.notificationEmail = plain.email;
      if (typeof plain.push === "boolean") $set.notificationPush = plain.push;
      if (typeof plain.weekly === "boolean") $set.notificationWeekly = plain.weekly;

      if (Object.keys($set).length === 0) {
        return res.status(400).json({ success: false, message: "No preferences to update" });
      }

      const updated = await User.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true })
        .select(PUBLIC_FIELDS)
        .lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Notification preferences updated",
        data: formatNotificationPrefs(updated as Record<string, unknown>),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return res.status(500).json({ success: false, message });
    }
  }

  static async updateUser(req: MulterRequest, res: Response) {
    try {
      const { id } = req["currentUser"] as { id: string };
      const plain = instanceToPlain(req.body as UpdateUserProfileDto) as Record<string, unknown>;
      const profileImage = req.file?.filename;

      const user: Record<string, unknown> = {};
      for (const key of PROFILE_PATCH_KEYS) {
        if (plain[key] !== undefined) {
          user[key] = plain[key];
        }
      }

      if (profileImage) {
        user.image = profileImage;
      }

      if (Object.keys(user).length === 0 && !profileImage) {
        return res.status(400).json({ success: false, message: "No valid fields to update" });
      }

      const updated = await User.findByIdAndUpdate(id, { $set: user }, { new: true, runValidators: true })
        .select(PUBLIC_FIELDS)
        .lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "User update failed" });
      }

      return res.status(200).json({
        success: true,
        message: "User update success",
        data: stripSensitive(updated),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return res.status(500).json({
        success: false,
        message,
      });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"] as { id: string };
      const { password, newPassword } = req.body;
      if (!password || !newPassword) {
        return res.status(400).json({ success: false, message: "password required" });
      }

      const encryptPassword = await encrypt.encryptpass(newPassword);
      const result = await User.updateOne({ _id: id }, { password: encryptPassword }, { upsert: false });
      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: "User update failed" });
      }

      return res.status(200).json({
        success: true,
        message: "User update success",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
