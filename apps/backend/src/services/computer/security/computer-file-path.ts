import { realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function isWithinDirectory(
  targetPath: string,
  directoryPath: string,
): boolean {
  const relativePath = path.relative(
    directoryPath,
    targetPath,
  );

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath))
  );
}

export async function resolveSafeComputerPath(
  requestedPath: string,
): Promise<string> {
  if (
    typeof requestedPath !== "string" ||
    requestedPath.trim().length === 0
  ) {
    throw new Error("File path is required.");
  }

  const homeDirectory = await realpath(os.homedir());

  const targetPath = path.resolve(
    homeDirectory,
    requestedPath,
  );

  if (!isWithinDirectory(targetPath, homeDirectory)) {
    throw new Error(
      "File access is restricted to the user home directory.",
    );
  }

  try {
    const resolvedTargetPath = await realpath(
      targetPath,
    );

    if (
      !isWithinDirectory(
        resolvedTargetPath,
        homeDirectory,
      )
    ) {
      throw new Error(
        "File access is restricted to the user home directory.",
      );
    }

    return resolvedTargetPath;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }

    const parentDirectory = await realpath(
      path.dirname(targetPath),
    );

    if (
      !isWithinDirectory(
        parentDirectory,
        homeDirectory,
      )
    ) {
      throw new Error(
        "File access is restricted to the user home directory.",
      );
    }

    return targetPath;
  }
}