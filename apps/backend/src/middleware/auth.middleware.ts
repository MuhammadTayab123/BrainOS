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
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }
}