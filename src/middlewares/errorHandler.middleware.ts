import { NextFunction, Request, Response } from "express";
import { HttpError } from "../helpers/http-error";
import { logger } from "../helpers/logger";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): any => {
  const httpError = error as HttpError;
  const statusCode = httpError.statusCode || 500;

  logger.error("Unhandled request error", {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    details: httpError.details || undefined,
  });
};