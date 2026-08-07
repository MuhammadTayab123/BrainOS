import express from "express";
import healthRoutes from "./routes/health.routes";
import webhookRoutes from "./routes/webhook.routes";

const app = express();

// Clerk webhooks (temporary)
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookRoutes
);
// JSON parser for the rest of the API
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to BrainOS 🚀");
});

app.use("/", healthRoutes);

export default app;