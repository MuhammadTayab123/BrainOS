import { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { getAuthenticatedUser } from "../services/auth/auth.service";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = getAuth(req);

    console.log("CLERK AUTH DEBUG:", {
      userId: auth.userId,
      sessionId: auth.sessionId,
      isAuthenticated: auth.isAuthenticated,
      authorizationHeader: req.headers.authorization
        ? "PRESENT"
        : "MISSING",
    });

    req.user = await getAuthenticatedUser(req);
    next();
  } catch (error) {
    next(error);
  }
}