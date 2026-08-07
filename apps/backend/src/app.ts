import express from "express";
import healthRoutes from "./routes/health.routes";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to BrainOS 🚀");
});

app.use("/", healthRoutes);

export default app;