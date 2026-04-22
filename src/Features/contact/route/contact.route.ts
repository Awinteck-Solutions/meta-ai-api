import * as express from "express";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { ContactController } from "../controllers/contact.controller";
import { CreateContactDto } from "../dto/contact.dto";

const Router = express.Router();

// NEW: submit public contact form from website
Router.post("/", validateDto(CreateContactDto), (req, res, next) =>
  ContactController.create(req, res).catch(next)
);

export default Router;
