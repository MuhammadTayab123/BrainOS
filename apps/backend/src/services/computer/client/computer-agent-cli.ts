import { parseArgs } from "node:util";
import { ComputerAgentClient } from "./computer-agent-client";
import { ComputerAgentRunner } from "./computer-agent-runner";
import {
  ComputerAgentCliConfig,
  ParseCliResult,
  RunComputerAgentCliOptions,
} from "./computer-agent-cli.types";

export const CLI_VERSION = "BrainOS Computer Agent Host Daemon v1.0.0";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;

export function formatVersionText(): string {
  return CLI_VERSION;
}

export function formatHelpText(): string {
  return `
BrainOS Computer Agent Host Daemon

Usage:
  brainos-agent [options]
  npm run agent:start -- [options]

Options:
  -a, --agent-id <id>            Registered computer agent ID (required or BRAINOS_AGENT_ID)
  -u, --api-url <url>            BrainOS backend API base URL (required or BRAINOS_API_URL)
  -c, --credential <secret>      Agent secret key or auth token (required or BRAINOS_AGENT_CREDENTIAL)
  -t, --token <token>            Alias for --credential
  -k, --key <key>                Alias for --credential
      --backend-url <url>        Alias for --api-url
      --heartbeat-interval <ms>  Heartbeat interval in milliseconds (default: 30000, min: 100)
      --poll-interval <ms>       Action polling interval in milliseconds (default: 3000, min: 100)
      --disable-polling          Disable action queue polling (heartbeat only)
      --timeout <ms>             HTTP request timeout in milliseconds (default: 10000)
  -h, --help                     Show this help message
  -v, --version                  Show version number

Environment Variables:
  BRAINOS_AGENT_ID               Agent identifier
  BRAINOS_API_URL                BrainOS backend server URL (e.g. http://localhost:4000)
  BRAINOS_BACKEND_URL            Alternative backend server URL
  BRAINOS_AGENT_CREDENTIAL       Agent authentication secret key / token
  BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS   Heartbeat frequency (ms)
  BRAINOS_AGENT_ACTION_POLL_INTERVAL_MS Action poll frequency (ms)
  BRAINOS_AGENT_ACTION_POLLING_ENABLED  Set to 'false' to disable action polling
  BRAINOS_AGENT_TIMEOUT_MS              HTTP timeout in milliseconds

Examples:
  # Run with CLI arguments:
  npm run agent -- -a my-agent -u http://localhost:4000 -c my-secret-token

  # Run using environment variables (.env):
  npm run agent:start
`.trim();
}

/**
 * Parses and strictly validates CLI arguments and environment variables.
 */
export function parseComputerAgentCliArgs(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): ParseCliResult {
  let parsed: ReturnType<typeof parseArgs>;

  try {
    parsed = parseArgs({
      args,
      options: {
        "agent-id": { type: "string", short: "a" },
        "api-url": { type: "string", short: "u" },
        "backend-url": { type: "string" },
        credential: { type: "string", short: "c" },
        token: { type: "string", short: "t" },
        key: { type: "string", short: "k" },
        "heartbeat-interval": { type: "string" },
        "poll-interval": { type: "string" },
        "disable-polling": { type: "boolean" },
        timeout: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    throw new Error(`Invalid CLI arguments: ${(err as Error).message}`);
  }

  const { values } = parsed;

  if (values.help) {
    return { type: "help", helpText: formatHelpText() };
  }

  if (values.version) {
    return { type: "version", versionText: formatVersionText() };
  }

  // 1. Agent ID resolution
  const rawAgentId =
    (values["agent-id"] as string | undefined) ??
    env.BRAINOS_AGENT_ID ??
    env.COMPUTER_AGENT_ID;

  if (!rawAgentId || !rawAgentId.trim()) {
    throw new Error(
      "Agent ID is required. Provide --agent-id <id> or set BRAINOS_AGENT_ID in environment.",
    );
  }
  const agentId = rawAgentId.trim();

  // 2. API URL resolution
  const rawApiUrl =
    (values["api-url"] as string | undefined) ??
    (values["backend-url"] as string | undefined) ??
    env.BRAINOS_BACKEND_URL ??
    env.BRAINOS_API_URL ??
    env.COMPUTER_AGENT_BACKEND_URL ??
    env.BRAINOS_URL;

  if (!rawApiUrl || !rawApiUrl.trim()) {
    throw new Error(
      "BrainOS API URL is required. Provide --api-url <url> or set BRAINOS_API_URL in environment.",
    );
  }

  const apiUrlTrimmed = rawApiUrl.trim();
  try {
    const parsedUrl = new URL(apiUrlTrimmed);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Protocol must be http: or https:");
    }
  } catch (err) {
    throw new Error(
      `Invalid API URL "${apiUrlTrimmed}": ${(err as Error).message}`,
    );
  }

  // 3. Credential resolution
  const rawCredential =
    (values.credential as string | undefined) ??
    (values.token as string | undefined) ??
    (values.key as string | undefined) ??
    env.BRAINOS_AGENT_CREDENTIAL ??
    env.COMPUTER_AGENT_CREDENTIAL ??
    env.BRAINOS_AGENT_TOKEN ??
    env.BRAINOS_AGENT_SECRET_KEY;

  if (!rawCredential || !rawCredential.trim()) {
    throw new Error(
      "Agent credential is required. Provide --credential <key> or set BRAINOS_AGENT_CREDENTIAL in environment.",
    );
  }
  const credential = rawCredential.trim();

  // 4. Heartbeat interval
  let heartbeatIntervalMs: number | undefined;
  const rawHb =
    (values["heartbeat-interval"] as string | undefined) ??
    env.BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS;
  if (rawHb !== undefined) {
    if (!/^\d+$/.test(rawHb.trim())) {
      throw new Error(`Invalid heartbeat-interval: "${rawHb}". Must be a positive integer.`);
    }
    heartbeatIntervalMs = Number.parseInt(rawHb.trim(), 10);
    if (heartbeatIntervalMs < 100) {
      throw new Error("Heartbeat interval must be at least 100ms.");
    }
  }

  // 5. Action polling interval
  let actionPollingIntervalMs: number | undefined;
  const rawPoll =
    (values["poll-interval"] as string | undefined) ??
    env.BRAINOS_AGENT_ACTION_POLL_INTERVAL_MS ??
    env.COMPUTER_AGENT_ACTION_POLL_INTERVAL_MS;
  if (rawPoll !== undefined) {
    if (!/^\d+$/.test(rawPoll.trim())) {
      throw new Error(`Invalid poll-interval: "${rawPoll}". Must be a positive integer.`);
    }
    actionPollingIntervalMs = Number.parseInt(rawPoll.trim(), 10);
    if (actionPollingIntervalMs < 100) {
      throw new Error("Action polling interval must be at least 100ms.");
    }
  }

  // 6. Action polling enabled
  let actionPollingEnabled: boolean | undefined;
  if (values["disable-polling"] === true) {
    actionPollingEnabled = false;
  } else {
    const rawPollingEnv =
      env.BRAINOS_AGENT_ACTION_POLLING_ENABLED ??
      env.COMPUTER_AGENT_ACTION_POLLING_ENABLED;
    if (rawPollingEnv !== undefined) {
      actionPollingEnabled = rawPollingEnv.trim().toLowerCase() !== "false";
    }
  }

  // 7. Timeout
  let timeoutMs: number | undefined;
  const rawTimeout =
    (values.timeout as string | undefined) ??
    env.BRAINOS_AGENT_TIMEOUT_MS;
  if (rawTimeout !== undefined) {
    if (!/^\d+$/.test(rawTimeout.trim())) {
      throw new Error(`Invalid timeout: "${rawTimeout}". Must be a positive integer.`);
    }
    timeoutMs = Number.parseInt(rawTimeout.trim(), 10);
    if (timeoutMs <= 0) {
      throw new Error("Timeout must be greater than 0ms.");
    }
  }

  return {
    type: "config",
    config: {
      agentId,
      apiUrl: apiUrlTrimmed,
      credential,
      heartbeatIntervalMs,
      actionPollingIntervalMs,
      actionPollingEnabled,
      timeoutMs,
    },
  };
}

/**
 * Runs the Computer Agent CLI daemon lifecycle.
 * Returns exit code (0 for success / clean exit, 1 for error).
 */
export async function runComputerAgentCli(
  args: string[],
  options: RunComputerAgentCliOptions = {},
): Promise<number> {
  const stdout = options.stdout ?? ((msg: string) => console.log(msg));
  const stderr = options.stderr ?? ((msg: string) => console.error(msg));
  const env = options.env ?? process.env;
  const signalTarget = options.signalTarget ?? process;
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;

  let parseResult: ParseCliResult;
  try {
    parseResult = parseComputerAgentCliArgs(args, env);
  } catch (err) {
    stderr(`[ERROR] ${(err as Error).message}`);
    stderr("Run with --help for available options and environment variables.");
    return 1;
  }

  if (parseResult.type === "help") {
    stdout(parseResult.helpText);
    return 0;
  }

  if (parseResult.type === "version") {
    stdout(parseResult.versionText);
    return 0;
  }

  const { config } = parseResult;

  stdout(`=======================================================`);
  stdout(`  BrainOS Computer Agent Host Daemon`);
  stdout(`  Agent ID:       ${config.agentId}`);
  stdout(`  Server API:     ${config.apiUrl}`);
  stdout(`  Heartbeat:      ${config.heartbeatIntervalMs ?? 30000}ms`);
  stdout(`  Action Polling: ${config.actionPollingEnabled === false ? "DISABLED" : `${config.actionPollingIntervalMs ?? 3000}ms`}`);
  stdout(`=======================================================`);

  const client = new ComputerAgentClient({
    agentId: config.agentId,
    baseUrl: config.apiUrl,
    credential: config.credential,
    timeoutMs: config.timeoutMs,
    fetch: options.fetch,
  });

  const runner = new ComputerAgentRunner({
    client,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    actionPollingIntervalMs: config.actionPollingIntervalMs,
    actionPollingEnabled: config.actionPollingEnabled,
    onStatusChange: (status, prevStatus) => {
      stdout(`[STATUS] Daemon state transition: ${prevStatus} -> ${status}`);
    },
    onHeartbeatSuccess: (event) => {
      stdout(`[HEARTBEAT] Acknowledged by server (agent: ${event.agentId}, successes: ${event.consecutiveSuccesses})`);
    },
    onHeartbeatError: (event) => {
      stderr(`[HEARTBEAT ERROR] ${event.error.message} (agent: ${event.agentId})`);
    },
    onActionPollSuccess: (event) => {
      if (event.hasAction && event.actionName) {
        stdout(`[ACTION CLAIMED] Claimed action "${event.actionName}" (actionId: ${event.actionId})`);
      }
    },
    onActionPollError: (event) => {
      stderr(`[ACTION POLL ERROR] ${event.error.message}`);
    },
    onActionExecutionComplete: (event) => {
      if (event.success) {
        stdout(`[ACTION COMPLETE] Successfully executed "${event.actionName}" (actionId: ${event.actionId}, correlationId: ${event.correlationId})`);
      } else {
        stderr(`[ACTION FAILED] Failed executing "${event.actionName}" (actionId: ${event.actionId}): ${event.error ?? "Unknown error"}`);
      }
    },
  });

  if (options.onRunnerCreated) {
    options.onRunnerCreated(runner);
  }

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    stdout(`\n[INFO] Received ${signal}. Shutting down Computer Agent runner gracefully...`);
    try {
      const stopPromise = runner.stop();
      const timeoutPromise = new Promise<void>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Shutdown timed out after ${shutdownTimeoutMs}ms.`));
        }, shutdownTimeoutMs);
        if (typeof timer.unref === "function") {
          timer.unref();
        }
      });
      await Promise.race([stopPromise, timeoutPromise]);
      stdout("[INFO] Computer Agent runner stopped cleanly.");
    } catch (err) {
      stderr(`[ERROR] Shutdown error: ${(err as Error).message}`);
    }
  };

  const onSigint = async () => { await shutdown("SIGINT"); };
  const onSigterm = async () => { await shutdown("SIGTERM"); };
  const onSighup = async () => { await shutdown("SIGHUP"); };

  signalTarget.on("SIGINT", onSigint);
  signalTarget.on("SIGTERM", onSigterm);
  signalTarget.on("SIGHUP", onSighup);

  try {
    stdout("[INFO] Starting Computer Agent runner loop...");
    await runner.start();
    stdout("[INFO] Computer Agent runner is active and connected to BrainOS.");
    return 0;
  } catch (err) {
    stderr(`[FATAL] Failed to start Computer Agent runner: ${(err as Error).message}`);
    return 1;
  }
}
