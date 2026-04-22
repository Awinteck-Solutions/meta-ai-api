import * as express from "express";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { FaqController } from "../controllers/faq.controller";
import { CreateFaqDto, UpdateFaqDto } from "../dto/faq.dto";

const Router = express.Router();

// NEW: list FAQs for dashboard training data
Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  FaqController.list(req, res).catch(next)
);

// NEW: create FAQ for dashboard training data
Router.post("/", authentification, attachBusinessContext, validateDto(CreateFaqDto), (req, res, next) =>
  FaqController.create(req, res).catch(next)
);

// NEW: update FAQ for dashboard training data
Router.put("/:id", authentification, attachBusinessContext, validateDto(UpdateFaqDto), (req, res, next) =>
  FaqController.update(req, res).catch(next)
);

// NEW: delete FAQ for dashboard training data
Router.delete("/:id", authentification, attachBusinessContext, (req, res, next) =>
  FaqController.remove(req, res).catch(next)
);

export default Router;
