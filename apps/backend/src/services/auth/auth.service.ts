import { Request } from "express";
import { getAuth } from "@clerk/express";

import { prisma } from "../../lib/prisma";
import { AuthenticatedUser } from "../../types/auth.types";

export async function getAuthenticatedUser(
  req: Request
): Promise<AuthenticatedUser> {
  const auth = getAuth(req);

  if (!auth.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkId: auth.userId,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  };
}