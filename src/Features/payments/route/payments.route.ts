import * as express from "express";
import { PaymentsController } from "../controllers/payments.controller";

const Router = express.Router();

Router.post("/webhook", (req, res, next) => {
  PaymentsController.webhook(req, res).catch(next);
});

export default Router;

