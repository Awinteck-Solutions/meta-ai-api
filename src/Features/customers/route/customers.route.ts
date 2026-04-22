import * as express from "express";
import { CustomersController } from "../controllers/customers.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";

const Router = express.Router();

Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  CustomersController.list(req, res).catch(next)
);

export default Router;

