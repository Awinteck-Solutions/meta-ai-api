import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    const { user, token } = await AuthService.register(req.body);
    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user,
        token,
      },
    });
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { user, token } = await AuthService.login(req.body);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token,
      },
    });
  }
     
    
    // FORGET PASSWORD
    static async forgotPassword(req: Request, res: Response) {
        try {
            res.status(200).json({ message: "Reset token sent to your email" });
            
        } catch (error) {
         return res
         .status(500)
         .json({ message: "Internal server error", error:error['sqlMessage']});
     
        }
     }
    // RESET PASSWORD
    static async resetPassword(req: Request, res: Response) {
        try {
             res.status(200).json({ message: "Your password has been reset successfull" });
        } catch (error) {
         return res
         .status(500)
         .json({ message: "Internal server error", error:error['sqlMessage']});
     
        }
     }
    
}