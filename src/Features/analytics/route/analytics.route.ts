import * as express from "express";
import { authentification } from "../../../middlewares/authentication.middleware";
import { attachBusinessContext } from "../../../middlewares/tenant.middleware";
import { AnalyticsController } from "../controllers/analytics.controller";

const Router = express.Router();

// NEW: analytics overview for dashboard
Router.get("/overview", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.overview(req, res).catch(next)
);

// NEW: monthly conversations / replies for chart
Router.get("/conversations-series", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.conversationsSeries(req, res).catch(next)
);

// NEW: recent activity feed from FAQs, catalog, orders, bookings, messages, customers
Router.get("/activity", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.activity(req, res).catch(next)
);

// NEW: bundled data for dashboard customers page (replaces separate customers/orders/bookings list calls)
Router.get("/customers-dashboard", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.customersDashboard(req, res).catch(next)
);

// NEW: summary stats for dashboard customers page (total / active / inactive / revenue)
Router.get("/customers-top-stats", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.customersTopStats(req, res).catch(next)
);

// NEW: summary stats for dashboard orders page (total / completed / pending / paid)
Router.get("/orders-top-stats", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.ordersTopStats(req, res).catch(next)
);

// NEW: summary stats for dashboard bookings page (total / completed / pending / paid)
Router.get("/bookings-top-stats", authentification, attachBusinessContext, (req, res, next) =>
  AnalyticsController.bookingsTopStats(req, res).catch(next)
);

export default Router;
