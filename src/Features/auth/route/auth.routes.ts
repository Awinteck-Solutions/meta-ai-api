import * as express from "express"; 
import {Response, Request} from "express"; 
import * as multer from 'multer';
import path = require("path");
import { Roles } from "../enums/roles.enum";
import { AuthController } from "../controllers/auth.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { Notification } from "../enums/notification.enum";
import { upload } from "../../../helpers/uploader";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { LoginDto, RegisterDto } from "../dto/auth.dto";


const Router = express.Router();

// ----------------------------------------- USER ROUTES ---------------------------------------------------
//
// AUTH


Router.post("/register",
    validateDto(RegisterDto),
    (req: Request, res: Response, next) => { 
        AuthController.signup(req, res).catch(next)
    }
);

Router.post("/login",
    validateDto(LoginDto),
    (req: Request, res: Response, next) => { 
        AuthController.login(req, res).catch(next)
    }
);


// FORGET PASSWORD
Router.post("/forgot-password",
    // notification(Notification.FORGOT_PASSWORD),
    (req: Request, res: Response) => { 
        AuthController.forgotPassword(req,res)
    }
);

// RESET PASSWORD
Router.post("/reset-password",
    // notification(Notification.RESET_PASSWORD),
    (req: Request, res: Response) => { 
        AuthController.resetPassword(req,res)
    }
);

export default Router;