import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  next(
    new AppError({
      message: "Route not found",
      statusCode: 404,
      code: "NOT_FOUND",
    })
  );
}