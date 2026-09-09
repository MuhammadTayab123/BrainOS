#!/usr/bin/env node
import dotenv from "dotenv";
import { runComputerAgentCli } from "../services/computer/client/computer-agent-cli";

// Load local environment files (.env)
dotenv.config();

/**
 * CLI executable entrypoint for the BrainOS Computer Agent Host Daemon.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const exitCode = await runComputerAgentCli(args);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

void main();
