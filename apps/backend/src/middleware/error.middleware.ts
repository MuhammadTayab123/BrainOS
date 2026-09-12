import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";
import { logger } from "../logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.error(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (
    ("type" in err && (err as any).type === "entity.too.large") ||
    ("status" in err && (err as any).status === 413)
  ) {
    logger.warn("Payload too large rejected", {
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload exceeds size limit.",
      },
    });
  }

  logger.error("Unexpected server error", err);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal Server Error",
    },
  });
}