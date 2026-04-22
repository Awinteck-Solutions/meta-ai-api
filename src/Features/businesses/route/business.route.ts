import * as express from "express";
import { BusinessController } from "../controllers/business.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { CreateBusinessDto, UpdateBusinessDto } from "../dto/business.dto";

const Router = express.Router();

Router.post("/", authentification, validateDto(CreateBusinessDto), (req, res, next) => {
  BusinessController.create(req, res).catch(next);
});

Router.get("/paystack-secret", authentification, (req, res, next) => {
  BusinessController.getPaystackSecret(req, res).catch(next);
});

Router.get("/", authentification, (req, res, next) => {
  BusinessController.getOne(req, res).catch(next);
});

Router.put("/", authentification, validateDto(UpdateBusinessDto), (req, res, next) => {
  BusinessController.update(req, res).catch(next);
});

// NEW: test WhatsApp connection from dashboard settings
Router.post("/whatsapp/test", authentification, (req, res, next) => {
  BusinessController.testWhatsapp(req, res).catch(next);
});

export default Router;

