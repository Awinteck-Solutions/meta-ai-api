import * as express from "express";
import { WhatsAppController } from "../controllers/whatsapp.controller";
import { WhatsappConnectController } from "../controllers/whatsapp-connect.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { FinalizeWhatsappConnectDto } from "../dto/finalize-whatsapp-connect.dto";

const Router = express.Router();

Router.get("/webhook", (req, res, next) => {
  WhatsAppController.verify(req, res).catch(next);
});

Router.post("/webhook", (req, res, next) => {
  WhatsAppController.webhook(req, res).catch(next);
});

Router.post("/connect/init", authentification, attachBusinessContext, (req, res, next) => {
  WhatsappConnectController.init(req, res).catch(next);
});

Router.post(
  "/connect/finalize",
  authentification,
  attachBusinessContext,
  validateDto(FinalizeWhatsappConnectDto),
  (req, res, next) => {
    WhatsappConnectController.finalize(req, res).catch(next);
  }
);

Router.get("/connect/status", authentification, attachBusinessContext, (req, res, next) => {
  WhatsappConnectController.status(req, res).catch(next);
});

Router.delete("/connect", authentification, attachBusinessContext, (req, res, next) => {
  WhatsappConnectController.disconnect(req, res).catch(next);
});

export default Router;

