import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";
import { logger } from "../logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.error(err.message);

    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  logger.error("Unexpected server error", err);

  return res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
  });
}