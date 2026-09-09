import { describe, expect, it, vi } from "vitest";
import {
  formatHelpText,
  formatVersionText,
  parseComputerAgentCliArgs,
  runComputerAgentCli,
} from "../../../../src/services/computer/client/computer-agent-cli";
import { ComputerAgentRunner } from "../../../../src/services/computer/client/computer-agent-runner";

describe("Computer Agent CLI", () => {
  describe("parseComputerAgentCliArgs", () => {
    it("parses valid full CLI arguments", () => {
      const args = [
        "--agent-id",
        "agent-123",
        "--api-url",
        "https://api.brainos.local",
        "--credential",
        "secret-cred-123",
        "--heartbeat-interval",
        "15000",
        "--poll-interval",
        "2000",
        "--timeout",
        "8000",
      ];

      const result = parseComputerAgentCliArgs(args, {});

      expect(result.type).toBe("config");
      if (result.type === "config") {
        expect(result.config).toEqual({
          agentId: "agent-123",
          apiUrl: "https://api.brainos.local",
          credential: "secret-cred-123",
          heartbeatIntervalMs: 15000,
          actionPollingIntervalMs: 2000,
          actionPollingEnabled: undefined,
          timeoutMs: 8000,
        });
      }
    });

    it("parses short alias flags (-a, -u, -c)", () => {
      const args = [
        "-a",
        "agent-short",
        "-u",
        "http://localhost:4000",
        "-c",
        "short-cred",
      ];

      const result = parseComputerAgentCliArgs(args, {});

      expect(result.type).toBe("config");
      if (result.type === "config") {
        expect(result.config.agentId).toBe("agent-short");
        expect(result.config.apiUrl).toBe("http://localhost:4000");
        expect(result.config.credential).toBe("short-cred");
      }
    });

    it("parses credential aliases (-t, -k, --token, --key)", () => {
      const resToken = parseComputerAgentCliArgs(
        ["-a", "a1", "-u", "http://localhost:4000", "--token", "tok-1"],
        {},
      );
      expect(resToken.type === "config" && resToken.config.credential).toBe("tok-1");

      const resKey = parseComputerAgentCliArgs(
        ["-a", "a1", "-u", "http://localhost:4000", "-k", "key-1"],
        {},
      );
      expect(resKey.type === "config" && resKey.config.credential).toBe("key-1");
    });

    it("parses backend-url alias and disable-polling flag", () => {
      const result = parseComputerAgentCliArgs(
        [
          "-a",
          "a1",
          "--backend-url",
          "http://127.0.0.1:3000",
          "-c",
          "cred",
          "--disable-polling",
        ],
        {},
      );

      expect(result.type).toBe("config");
      if (result.type === "config") {
        expect(result.config.apiUrl).toBe("http://127.0.0.1:3000");
        expect(result.config.actionPollingEnabled).toBe(false);
      }
    });

    it("resolves from environment variables when CLI flags are absent", () => {
      const env: NodeJS.ProcessEnv = {
        BRAINOS_AGENT_ID: "env-agent",
        BRAINOS_API_URL: "https://backend.brainos.internal",
        BRAINOS_AGENT_CREDENTIAL: "env-secret-key",
        BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS: "20000",
        BRAINOS_AGENT_ACTION_POLL_INTERVAL_MS: "5000",
        BRAINOS_AGENT_ACTION_POLLING_ENABLED: "false",
        BRAINOS_AGENT_TIMEOUT_MS: "12000",
      };

      const result = parseComputerAgentCliArgs([], env);

      expect(result.type).toBe("config");
      if (result.type === "config") {
        expect(result.config).toEqual({
          agentId: "env-agent",
          apiUrl: "https://backend.brainos.internal",
          credential: "env-secret-key",
          heartbeatIntervalMs: 20000,
          actionPollingIntervalMs: 5000,
          actionPollingEnabled: false,
          timeoutMs: 12000,
        });
      }
    });

    it("prioritizes CLI arguments over environment variables", () => {
      const env: NodeJS.ProcessEnv = {
        BRAINOS_AGENT_ID: "env-agent",
        BRAINOS_API_URL: "http://localhost:4000",
        BRAINOS_AGENT_CREDENTIAL: "env-secret",
      };

      const result = parseComputerAgentCliArgs(
        ["--agent-id", "cli-agent", "--credential", "cli-secret"],
        env,
      );

      expect(result.type).toBe("config");
      if (result.type === "config") {
        expect(result.config.agentId).toBe("cli-agent");
        expect(result.config.apiUrl).toBe("http://localhost:4000");
        expect(result.config.credential).toBe("cli-secret");
      }
    });

    it("returns help on --help or -h", () => {
      const res1 = parseComputerAgentCliArgs(["--help"], {});
      expect(res1.type).toBe("help");
      if (res1.type === "help") {
        expect(res1.helpText).toContain("BrainOS Computer Agent Host Daemon");
        expect(res1.helpText).toContain("--agent-id");
      }

      const res2 = parseComputerAgentCliArgs(["-h"], {});
      expect(res2.type).toBe("help");
    });

    it("returns version on --version or -v", () => {
      const res1 = parseComputerAgentCliArgs(["--version"], {});
      expect(res1.type).toBe("version");
      if (res1.type === "version") {
        expect(res1.versionText).toContain("BrainOS Computer Agent Host Daemon");
      }

      const res2 = parseComputerAgentCliArgs(["-v"], {});
      expect(res2.type).toBe("version");
    });

    it("throws when unknown positional arguments or options are provided", () => {
      expect(() => parseComputerAgentCliArgs(["unknown-arg"], {})).toThrow(
        "Invalid CLI arguments",
      );
      expect(() => parseComputerAgentCliArgs(["--unknown-option"], {})).toThrow(
        "Invalid CLI arguments",
      );
    });

    it("throws when agentId is missing", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          ["-u", "http://localhost:4000", "-c", "cred"],
          {},
        ),
      ).toThrow("Agent ID is required");
    });

    it("throws when apiUrl is missing", () => {
      expect(() =>
        parseComputerAgentCliArgs(["-a", "agent-1", "-c", "cred"], {}),
      ).toThrow("BrainOS API URL is required");
    });

    it("throws when apiUrl is malformed or has invalid protocol", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          ["-a", "agent-1", "-u", "not-a-valid-url", "-c", "cred"],
          {},
        ),
      ).toThrow("Invalid API URL");

      expect(() =>
        parseComputerAgentCliArgs(
          ["-a", "agent-1", "-u", "ftp://localhost:4000", "-c", "cred"],
          {},
        ),
      ).toThrow("Protocol must be http: or https:");
    });

    it("throws when credential is missing", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          ["-a", "agent-1", "-u", "http://localhost:4000"],
          {},
        ),
      ).toThrow("Agent credential is required");
    });

    it("throws on invalid heartbeat-interval", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          [
            "-a",
            "a1",
            "-u",
            "http://localhost:4000",
            "-c",
            "cred",
            "--heartbeat-interval",
            "not-a-number",
          ],
          {},
        ),
      ).toThrow("Invalid heartbeat-interval");

      expect(() =>
        parseComputerAgentCliArgs(
          [
            "-a",
            "a1",
            "-u",
            "http://localhost:4000",
            "-c",
            "cred",
            "--heartbeat-interval",
            "50",
          ],
          {},
        ),
      ).toThrow("Heartbeat interval must be at least 100ms");
    });

    it("throws on invalid poll-interval", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          [
            "-a",
            "a1",
            "-u",
            "http://localhost:4000",
            "-c",
            "cred",
            "--poll-interval",
            "abc",
          ],
          {},
        ),
      ).toThrow("Invalid poll-interval");

      expect(() =>
        parseComputerAgentCliArgs(
          [
            "-a",
            "a1",
            "-u",
            "http://localhost:4000",
            "-c",
            "cred",
            "--poll-interval",
            "40",
          ],
          {},
        ),
      ).toThrow("Action polling interval must be at least 100ms");
    });

    it("throws on invalid timeout", () => {
      expect(() =>
        parseComputerAgentCliArgs(
          [
            "-a",
            "a1",
            "-u",
            "http://localhost:4000",
            "-c",
            "cred",
            "--timeout",
            "0",
          ],
          {},
        ),
      ).toThrow("Timeout must be greater than 0ms");
    });
  });

  describe("formatHelpText and formatVersionText", () => {
    it("returns formatted version string", () => {
      expect(formatVersionText()).toContain("BrainOS Computer Agent");
    });

    it("returns formatted help string containing usage instructions", () => {
      const help = formatHelpText();
      expect(help).toContain("Usage:");
      expect(help).toContain("--agent-id");
      expect(help).toContain("BRAINOS_AGENT_CREDENTIAL");
    });
  });

  describe("runComputerAgentCli lifecycle", () => {
    it("handles --help cleanly with exit code 0", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const exitCode = await runComputerAgentCli(["--help"], {
        stdout: (msg) => stdoutLines.push(msg),
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(0);
      expect(stdoutLines.join("\n")).toContain("Usage:");
      expect(stderrLines).toHaveLength(0);
    });

    it("handles --version cleanly with exit code 0", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const exitCode = await runComputerAgentCli(["--version"], {
        stdout: (msg) => stdoutLines.push(msg),
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(0);
      expect(stdoutLines.join("\n")).toContain("BrainOS Computer Agent Host Daemon");
      expect(stderrLines).toHaveLength(0);
    });

    it("handles invalid arguments with exit code 1 and error message", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const exitCode = await runComputerAgentCli(["--invalid-flag"], {
        stdout: (msg) => stdoutLines.push(msg),
        stderr: (msg) => stderrLines.push(msg),
      });

      expect(exitCode).toBe(1);
      expect(stderrLines.join("\n")).toContain("[ERROR]");
      expect(stderrLines.join("\n")).toContain("Run with --help");
    });

    it("initializes runner, starts daemon, and redacts secret credentials from output", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const rawSecret = "super-secret-token-123456";

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: "env-1",
              version: "1.0",
              timestamp: Date.now(),
              success: true,
              data: { status: "OK" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );

      let capturedRunner: ComputerAgentRunner | null = null;
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      const fakeSignalTarget = {
        on: (event: string, listener: (...args: unknown[]) => void) => {
          listeners[event] = listeners[event] ?? [];
          listeners[event].push(listener);
        },
        removeListener: (event: string, listener: (...args: unknown[]) => void) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((l) => l !== listener);
          }
        },
      };

      const exitCode = await runComputerAgentCli(
        [
          "-a",
          "agent-live",
          "-u",
          "http://localhost:4000",
          "-c",
          rawSecret,
          "--disable-polling",
        ],
        {
          stdout: (msg) => stdoutLines.push(msg),
          stderr: (msg) => stderrLines.push(msg),
          fetch: mockFetch as unknown as typeof fetch,
          signalTarget: fakeSignalTarget,
          onRunnerCreated: (r) => {
            capturedRunner = r;
          },
        },
      );

      expect(exitCode).toBe(0);
      expect(capturedRunner).not.toBeNull();
      expect(capturedRunner!.isRunning).toBe(true);

      const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
      expect(allOutput).toContain("agent-live");
      expect(allOutput).toContain("http://localhost:4000");
      // Verify raw credentials never appear in console outputs
      expect(allOutput).not.toContain(rawSecret);

      // Verify clean shutdown on SIGINT
      expect(listeners.SIGINT).toBeDefined();
      expect(listeners.SIGINT.length).toBeGreaterThan(0);

      const sigintHandler = listeners.SIGINT[0];
      await sigintHandler();

      expect(capturedRunner!.isRunning).toBe(false);
      expect(stdoutLines.join("\n")).toContain("Shutting down Computer Agent runner gracefully");
      expect(stdoutLines.join("\n")).toContain("Computer Agent runner stopped cleanly");
    });

    it("handles runner startup failure safely with exit code 1", async () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      // Mock fetch to return 401 Unauthorized during startup ping
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid credential signature",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );

      const exitCode = await runComputerAgentCli(
        [
          "-a",
          "bad-agent",
          "-u",
          "http://localhost:4000",
          "-c",
          "bad-cred",
        ],
        {
          stdout: (msg) => stdoutLines.push(msg),
          stderr: (msg) => stderrLines.push(msg),
          fetch: mockFetch as unknown as typeof fetch,
        },
      );

      expect(exitCode).toBe(1);
      expect(stderrLines.join("\n")).toContain("[FATAL] Failed to start Computer Agent runner");
    });
  });
});
