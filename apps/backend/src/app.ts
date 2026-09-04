import devRoutes from "./routes/dev.routes";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env";

import healthRoutes from "./routes/health.routes";
import webhookRoutes from "./routes/webhook.routes";

import { requestLogger } from "./middleware/logger.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { errorHandler } from "./middleware/error.middleware";
import userRoutes from "./routes/user.routes";
import memoryRoutes from "./routes/memory.routes";
import assistantRoutes from "./routes/assistant.routes";
import conversationRoutes from "./routes/conversation.routes";
import documentRoutes from "./routes/document.routes";
import automationRoutes from "./routes/automation.routes";
import taskRoutes from "./routes/task.routes";
import reminderRoutes from "./routes/reminder.routes";

// Clerk webhooks
const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

// Clerk Authentication
app.use(
  clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  }),
);

// Clerk webhooks
app.use("/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

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

// Document routes
app.use("/api/v1/documents", documentRoutes);
// Assistant routes
app.use("/api/v1/assistant", assistantRoutes);

// Conversation routes
app.use("/api/v1/conversations", conversationRoutes);

// Automation routes
app.use("/api/v1/automations", automationRoutes);

// Task routes
app.use("/api/v1/tasks", taskRoutes);

// Reminder routes
app.use("/api/v1/reminders", reminderRoutes);

// Development routes
app.use("/api/v1/dev", devRoutes);

// 404 Middleware
app.use(notFoundHandler);

// Error Middleware (ALWAYS LAST)
app.use(errorHandler);

export default app;
