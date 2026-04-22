import "express-serve-static-core";
import multer from "multer";

interface CurrentUser {
    id: string;
    email: string;
    role?: string;
}

declare module "express-serve-static-core" {
    interface Request {
        file?: multer.File;
        currentUser?: CurrentUser;
        businessId?: string;
        rawBody?: string;
    }
}

export {};
