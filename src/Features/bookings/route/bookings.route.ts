import * as express from "express";
import { BookingsController } from "../controllers/bookings.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { validateDto } from "../../../middlewares/validateDto.middleware";
import { UpdateBookingStatusDto } from "../dto/booking.dto";

const Router = express.Router();

Router.get("/", authentification, attachBusinessContext, (req, res, next) =>
  BookingsController.list(req, res).catch(next)
);

// NEW: update a booking status from dashboard workflows
Router.put(
  "/:id/status",
  authentification,
  attachBusinessContext,
  validateDto(UpdateBookingStatusDto),
  (req, res, next) => BookingsController.updateStatus(req, res).catch(next)
);

export default Router;

