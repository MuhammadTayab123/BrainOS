import { Request } from "express";
import { getAuth } from "@clerk/express";

import { prisma } from "../../lib/prisma";
import { AuthenticatedUser } from "../../types/auth.types";

export async function getAuthenticatedUser(
  req: Request
): Promise<AuthenticatedUser> {
  const auth = getAuth(req);

console.log("========== BRAINOS AUTH DEBUG ==========");
console.log("Authorization header present:", Boolean(req.headers.authorization));
console.log(
  "Authorization scheme:",
  req.headers.authorization?.split(" ")[0] ?? "NONE"
);
console.log("Clerk userId:", auth.userId);
console.log("Clerk sessionId:", auth.sessionId);

  if (!auth.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkId: auth.userId,
    },
  });

  console.log(
    "Database user:",
    user ? `FOUND (${user.clerkId})` : "NOT FOUND"
  );

  console.log("========================================");

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