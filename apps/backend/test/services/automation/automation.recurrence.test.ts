import { describe, expect, it } from "vitest";

import { calculateNextRunAt } from "../../../src/services/automation/automation.recurrence";

describe("Automation recurrence", () => {
  it("calculates the next daily run", () => {
    const from = new Date("2026-08-26T10:30:00");

    const result = calculateNextRunAt(
      {
        type: "DAILY",
        hour: 8,
        minute: 0,
      },
      from,
    );

    expect(result).toEqual(new Date("2026-08-27T08:00:00"));
  });

  it("calculates today's daily run when it is still upcoming", () => {
    const from = new Date("2026-08-26T07:30:00");

    const result = calculateNextRunAt(
      {
        type: "DAILY",
        hour: 8,
        minute: 0,
      },
      from,
    );

    expect(result).toEqual(new Date("2026-08-26T08:00:00"));
  });

  it("calculates the next weekly run", () => {
    const from = new Date("2026-08-26T10:30:00");

    const result = calculateNextRunAt(
      {
        type: "WEEKLY",
        dayOfWeek: 5,
        hour: 9,
        minute: 0,
      },
      from,
    );

    expect(result).toEqual(new Date("2026-08-28T09:00:00"));
  });

  it("rejects an invalid daily hour", () => {
    expect(() =>
      calculateNextRunAt(
        {
          type: "DAILY",
          hour: 24,
          minute: 0,
        },
        new Date(),
      ),
    ).toThrow("Automation recurrence hour must be between 0 and 23.");
  });

  it("rejects an invalid weekly day", () => {
    expect(() =>
      calculateNextRunAt(
        {
          type: "WEEKLY",
          dayOfWeek: 7,
          hour: 9,
          minute: 0,
        },
        new Date(),
      ),
    ).toThrow("Automation recurrence day must be between 0 and 6.");
  });

  it("rejects an invalid date", () => {
    expect(() =>
      calculateNextRunAt(
        {
          type: "DAILY",
          hour: 8,
          minute: 0,
        },
        new Date("invalid"),
      ),
    ).toThrow("Automation recurrence date must be valid.");
  });
});
