import * as express from "express";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { BillingController } from "../controllers/billing.controller";
import { InitializeSubscriptionDto } from "../dto/initialize-subscription.dto";

const Router = express.Router();

Router.get("/summary", authentification, attachBusinessContext, (req, res, next) =>
  BillingController.summary(req, res).catch(next)
);

Router.post(
  "/subscription/initialize",
  authentification,
  attachBusinessContext,
  validateDto(InitializeSubscriptionDto),
  (req, res, next) => BillingController.initializeSubscription(req, res).catch(next)
);

export default Router;
