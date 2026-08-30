import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { resolveSafeComputerPath } from "../../src/services/computer/security/computer-file-path";

describe("resolveSafeComputerPath", () => {
  it("resolves a path inside the user home directory", async () => {
    const resolved = await resolveSafeComputerPath(".");

    expect(resolved).toBe(await import("node:fs/promises").then(({ realpath }) => realpath(os.homedir())));
  });

  it("allows an existing file inside the user home directory", async () => {
    const fileName = `.brainos-security-test-${Date.now()}.txt`;
    const filePath = path.join(os.homedir(), fileName);

    await writeFile(filePath, "test", "utf8");

    try {
      const resolved = await resolveSafeComputerPath(fileName);

      expect(resolved).toBe(filePath);
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it("allows a new file path whose parent exists inside home", async () => {
    const directoryName = `.brainos-security-test-${Date.now()}`;
    const directoryPath = path.join(os.homedir(), directoryName);
    const filePath = path.join(directoryName, "new-file.txt");

    await mkdir(directoryPath);

    try {
      const resolved = await resolveSafeComputerPath(filePath);

      expect(resolved).toBe(path.join(directoryPath, "new-file.txt"));
    } finally {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it("rejects paths outside the user home directory", async () => {
    await expect(
      resolveSafeComputerPath(path.resolve(os.homedir(), "..")),
    ).rejects.toThrow(
      "File access is restricted to the user home directory.",
    );
  });

  it("rejects traversal outside the user home directory", async () => {
    await expect(
      resolveSafeComputerPath("../../outside-brainos"),
    ).rejects.toThrow(
      "File access is restricted to the user home directory.",
    );
  });

  it("rejects an empty path", async () => {
    await expect(
      resolveSafeComputerPath(""),
    ).rejects.toThrow("File path is required.");
  });
});