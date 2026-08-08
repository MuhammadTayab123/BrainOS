import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env";


import healthRoutes from "./routes/health.routes";
import webhookRoutes from "./routes/webhook.routes";

import { requestLogger } from "./middleware/logger.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";
import userRoutes from "./routes/user.routes";

const app = express();

// Clerk webhooks
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

// JSON parser
app.use(express.json());



// Clerk Authentication


app.use(
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  })
);

// Request logging
app.use(requestLogger);

// Home route
app.get("/", (req, res) => {
  res.send("Welcome to BrainOS 🚀");
});

// Health routes
app.use("/", healthRoutes);

// User routes
app.use("/api/v1/users", userRoutes);

// 404 Middleware
app.use(notFoundHandler);

// Error Middleware (ALWAYS LAST)
app.use(errorHandler);

export default app;