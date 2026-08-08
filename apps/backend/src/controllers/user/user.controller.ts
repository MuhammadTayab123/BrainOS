import { Request, Response } from "express";

export async function getCurrentUser(req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
}