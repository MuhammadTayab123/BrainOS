import "dotenv/config";

import app from "./app";
import { env } from "./config/env";
import { logger } from "./logger";



const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`BrainOS Backend running at http://localhost:${PORT}`);
});