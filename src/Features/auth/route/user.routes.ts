import * as express from "express";
import { Response, Request, NextFunction } from "express";
import { UserController } from "../controllers/user.controller";
import { Roles } from "../enums/roles.enum";
import multer from "multer";
import { authentification } from "../../../middlewares/authentication.middleware";
import { authorization } from "../../../middlewares/authorization.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { UpdateUserProfileDto } from "../dto/update-user-profile.dto";
import { UpdateNotificationPreferencesDto } from "../dto/update-notification-preferences.dto";

interface MulterRequest extends Request {
  file?: multer.File;
}

const Router = express.Router();

Router.delete("/delete-user/:id", authentification, (req: Request, res: Response, next: NextFunction) => {
  UserController.deleteUser(req, res).catch(next);
});

Router.get(
  "/",
  authentification,
  authorization([Roles.ADMIN, Roles.HR, Roles.PAYROLL, Roles.PROJECTS]),
  (req: Request, res: Response, next: NextFunction) => {
    UserController.getAllUsers(req, res).catch(next);
  },
);

/** Static paths must be registered before `/:id` so `/profile` is not captured as an id. */
Router.get("/profile", authentification, (req: Request, res: Response, next: NextFunction) => {
  UserController.profile(req, res).catch(next);
});

Router.get("/notification-preferences", authentification, (req: Request, res: Response, next: NextFunction) => {
  UserController.getNotificationPreferences(req, res).catch(next);
});

Router.patch(
  "/notification-preferences",
  authentification,
  validateDto(UpdateNotificationPreferencesDto),
  (req: Request, res: Response, next: NextFunction) => {
    UserController.updateNotificationPreferences(req, res).catch(next);
  },
);

Router.patch(
  "/update-user",
  authentification,
  validateDto(UpdateUserProfileDto),
  (req: MulterRequest, res: Response, next: NextFunction) => {
    UserController.updateUser(req, res).catch(next);
  },
);

Router.patch("/change-password", authentification, (req: Request, res: Response, next: NextFunction) => {
  UserController.changePassword(req, res).catch(next);
});

Router.patch(
  "/update-user/:id",
  authentification,
  validateDto(UpdateUserProfileDto),
  (req: MulterRequest, res: Response, next: NextFunction) => {
    UserController.updateUser(req, res).catch(next);
  },
);

Router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  UserController.getOneUser(req, res).catch(next);
});

export default Router;
