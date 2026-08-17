import { NextFunction, Request, Response } from "express";
import { getAuthenticatedUser } from "../services/auth/auth.service";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    req.user = await getAuthenticatedUser(req);
    next();
  } catch (error) {
    next(error);
  }
}
