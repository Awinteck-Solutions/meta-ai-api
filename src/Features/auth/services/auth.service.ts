import { encrypt } from "../../../helpers/tokenizer";
import { HttpError } from "../../../helpers/http-error";
import User from "../schema/user.schema";

export class AuthService {
  static async register(payload: {
    firstname?: string;
    lastname?: string;
    email: string;
    password: string;
  }) {
    const existing = await User.findOne({ email: payload.email }).lean();
    if (existing) {
      throw new HttpError("Email already registered", 409);
    }

    const user = await User.create({
      firstname: payload.firstname || null,
      lastname: payload.lastname || null,
      email: payload.email,
      password: await encrypt.encryptpass(payload.password),
      otp: "0000",
      role: "owner",
    });

    const token = encrypt.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  static async login(payload: { email: string; password: string }) {
    const user = await User.findOne({ email: payload.email });
    if (!user || !user.password) {
      throw new HttpError("Invalid credentials", 401);
    }

    const match = encrypt.comparepassword(payload.password, user.password);
    if (!match) {
      throw new HttpError("Invalid credentials", 401);
    }

    const token = encrypt.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }
}

