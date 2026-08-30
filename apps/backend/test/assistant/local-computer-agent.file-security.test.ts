import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";

import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";
import {
  MAX_COMPUTER_FILE_SIZE_BYTES,
} from "../../src/services/computer/security/computer-file-limits";

describe("LocalComputerAgent file operation security", () => {
  it("reads a normal file inside the user home directory", async () => {
    const agent = new LocalComputerAgent();

    const fileName = `.brainos-read-test-${Date.now()}.txt`;
    const filePath = path.join(os.homedir(), fileName);

    await writeFile(filePath, "BrainOS test", "utf8");

    try {
      const result = await agent.readFile(fileName);

      expect(result.path).toBe(filePath);
      expect(result.content).toBe("BrainOS test");
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it("rejects reading a directory", async () => {
    const agent = new LocalComputerAgent();

    const directoryName =
      `.brainos-read-directory-${Date.now()}`;
    const directoryPath =
      path.join(os.homedir(), directoryName);

    await mkdir(directoryPath);

    try {
      await expect(
        agent.readFile(directoryName),
      ).rejects.toThrow(
        "The requested path is not a file.",
      );
    } finally {
      await rm(directoryPath, {
        recursive: true,
        force: true,
      });
    }
  });

  it("rejects reading a file larger than the maximum size", async () => {
    const agent = new LocalComputerAgent();

    const fileName =
      `.brainos-large-read-${Date.now()}.txt`;
    const filePath =
      path.join(os.homedir(), fileName);

    const largeContent = Buffer.alloc(
      MAX_COMPUTER_FILE_SIZE_BYTES + 1,
      "a",
    );

    await writeFile(filePath, largeContent);

    try {
      await expect(
        agent.readFile(fileName),
      ).rejects.toThrow(
        "File exceeds the maximum allowed size.",
      );
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it("writes a normal file inside the user home directory", async () => {
    const agent = new LocalComputerAgent();

    const fileName =
      `.brainos-write-test-${Date.now()}.txt`;
    const filePath =
      path.join(os.homedir(), fileName);

    try {
      const result = await agent.writeFile(
        fileName,
        "BrainOS write test",
      );

      expect(result).toEqual({
        path: filePath,
        success: true,
      });
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it("rejects writing content larger than the maximum size", async () => {
    const agent = new LocalComputerAgent();

    const fileName =
      `.brainos-large-write-${Date.now()}.txt`;

    const largeContent = "a".repeat(
      MAX_COMPUTER_FILE_SIZE_BYTES + 1,
    );

    await expect(
      agent.writeFile(fileName, largeContent),
    ).rejects.toThrow(
      "File content exceeds the maximum allowed size.",
    );
  });

  it("rejects writing to a directory", async () => {
    const agent = new LocalComputerAgent();

    const directoryName =
      `.brainos-write-directory-${Date.now()}`;
    const directoryPath =
      path.join(os.homedir(), directoryName);

    await mkdir(directoryPath);

    try {
      await expect(
        agent.writeFile(
          directoryName,
          "should fail",
        ),
      ).rejects.toThrow(
        "The requested path is not a file.",
      );
    } finally {
      await rm(directoryPath, {
        recursive: true,
        force: true,
      });
    }
  });
});