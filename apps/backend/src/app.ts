import express from "express";
import { AppError } from "./errors";

import healthRoutes from "./routes/health.routes";
import webhookRoutes from "./routes/webhook.routes";

import { requestLogger } from "./middleware/logger.middleware";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

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



// ⭐ Error middleware MUST be LAST
app.use(errorHandler);

export default app;