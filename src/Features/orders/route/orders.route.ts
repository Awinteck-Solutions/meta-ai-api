import * as express from "express";
import { OrdersController } from "../controllers/orders.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { UpdateOrderStatusDto } from "../dto/order.dto";

const Router = express.Router();

Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  OrdersController.list(req, res).catch(next)
);

// NEW: update an order status from dashboard workflows
Router.put(
  "/:id/status",
  authentification,
  attachBusinessContext,
  validateDto(UpdateOrderStatusDto),
  (req, res, next) => OrdersController.updateStatus(req, res).catch(next)
);

export default Router;

