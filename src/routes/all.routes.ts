import * as express from "express"; 
import path = require("path");

import userRoutes from "../Features/auth/route/user.routes";
import authRoutes from "../Features/auth/route/auth.routes"; 
import businessRoutes from "../Features/businesses/route/business.route";
import catalogRoutes from "../Features/catalog/route/catalog.route";
import ordersRoutes from "../Features/orders/route/orders.route";
import bookingsRoutes from "../Features/bookings/route/bookings.route";
import customersRoutes from "../Features/customers/route/customers.route";
import messagesRoutes from "../Features/messages/route/messages.route";
import paymentsRoutes from "../Features/payments/route/payments.route";
import whatsappRoutes from "../Features/whatsapp/route/whatsapp.route";
import faqRoutes from "../Features/faq/route/faq.route";
import analyticsRoutes from "../Features/analytics/route/analytics.route";
import billingRoutes from "../Features/billing/route/billing.route";
import contactRoutes from "../Features/contact/route/contact.route";

const Router = express.Router();

/**
 * @swagger
 * /auth:
 *   get:
 *     summary: Authentication routes
 */
Router.use("/auth", authRoutes);

Router.use("/users", userRoutes);

 
Router.use("/business", businessRoutes);
Router.use("/catalog", catalogRoutes);
Router.use("/orders", ordersRoutes);
Router.use("/bookings", bookingsRoutes);
Router.use("/customers", customersRoutes);
Router.use("/messages", messagesRoutes);
Router.use("/payments", paymentsRoutes);
Router.use("/whatsapp", whatsappRoutes);
Router.use("/faq", faqRoutes);
Router.use("/analytics", analyticsRoutes);
Router.use("/billing", billingRoutes);
Router.use("/contact", contactRoutes);
 


export { Router }