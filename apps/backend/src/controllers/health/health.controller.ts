import { Request, Response } from "express";
import { env } from "../../config/env";

export const getHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};