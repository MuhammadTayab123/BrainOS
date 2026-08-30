import { describe, expect, it } from "vitest";

import {
  getComputerActionRisk,
  isComputerTool,
  requiresComputerAuthorization,
} from "../../src/services/security/computer-action.policy";

describe("computer action policy", () => {
  it("classifies read-only computer tools", () => {
    expect(
      getComputerActionRisk(
        "computer_get_status",
      ),
    ).toBe("READ_ONLY");

    expect(
      getComputerActionRisk(
        "computer_list_applications",
      ),
    ).toBe("READ_ONLY");

    expect(
      getComputerActionRisk(
        "computer_list_files",
      ),
    ).toBe("READ_ONLY");

    expect(
      getComputerActionRisk(
        "computer_read_file",
      ),
    ).toBe("READ_ONLY");
  });

  it("classifies computer actions", () => {
    expect(
      getComputerActionRisk(
        "computer_launch_application",
      ),
    ).toBe("ACTION");

    expect(
      getComputerActionRisk(
        "computer_write_file",
      ),
    ).toBe("ACTION");
  });

  it("requires authorization for actions", () => {
    expect(
      requiresComputerAuthorization(
        "computer_get_status",
      ),
    ).toBe(false);

    expect(
      requiresComputerAuthorization(
        "computer_read_file",
      ),
    ).toBe(false);

    expect(
      requiresComputerAuthorization(
        "computer_launch_application",
      ),
    ).toBe(true);

    expect(
      requiresComputerAuthorization(
        "computer_write_file",
      ),
    ).toBe(true);
  });

  it("recognizes registered computer tools", () => {
    expect(
      isComputerTool("computer_get_status"),
    ).toBe(true);

    expect(
      isComputerTool("computer_write_file"),
    ).toBe(true);

    expect(
      isComputerTool("unknown_tool"),
    ).toBe(false);
  });

  it("returns undefined for unknown tools", () => {
    expect(
      getComputerActionRisk("unknown_tool"),
    ).toBeUndefined();
  });
});