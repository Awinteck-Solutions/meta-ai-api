import * as express from "express";
import { MessagesController } from "../controllers/messages.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { SendMessageDto } from "../dto/message.dto";

const Router = express.Router();

Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  MessagesController.list(req, res).catch(next)
);

// NEW: fetch thread messages by customer phone
Router.get("/thread/:customerPhone", authentification, attachBusinessContext, (req, res, next) =>
  MessagesController.thread(req, res).catch(next)
);

// NEW: send a human reply message
Router.post("/send", authentification, attachBusinessContext, validateDto(SendMessageDto), (req, res, next) =>
  MessagesController.send(req, res).catch(next)
);

export default Router;

