import devRoutes from "./routes/dev.routes";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env";


import healthRoutes from "./routes/health.routes";
import webhookRoutes from "./routes/webhook.routes";

import { requestLogger } from "./middleware/logger.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";
import userRoutes from "./routes/user.routes";
import memoryRoutes from "./routes/memory.routes";



// Clerk webhooks
const app = express();

// Clerk Authentication
app.use(
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
    debug: true,
  })
);

// Clerk webhooks
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

// JSON parser
app.use(express.json());

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
// Memory routes

app.use("/api/v1/memories", memoryRoutes);

// Development routes
app.use("/api/v1/dev", devRoutes);

// 404 Middleware
app.use(notFoundHandler);

// Error Middleware (ALWAYS LAST)
app.use(errorHandler);

export default app;