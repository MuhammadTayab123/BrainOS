import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { Prisma } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { prisma } from "../../src/lib/prisma";
import { PrismaCalendarEventRepository } from "../../src/services/calendar/repositories/calendar.repository";
import {
  CalendarEventStatus,
} from "../../src/services/calendar/calendar.types";
import { assertSafeTestEnvironment } from "../safety";

const userA = {
  id: "calendar-integration-user-a",
  clerkId: "calendar-integration-clerk-a",
  email: "calendar-integration-user-a@example.test",
};

const userB = {
  id: "calendar-integration-user-b",
  clerkId: "calendar-integration-clerk-b",
  email: "calendar-integration-user-b@example.test",
};

const testUserIds = [userA.id, userB.id];

const calendarRepository = new PrismaCalendarEventRepository();

function assertTestDatabaseSafety(): void {
  assertSafeTestEnvironment();
}

async function cleanupIntegrationRows(): Promise<void> {
  assertTestDatabaseSafety();

  await prisma.calendarEvent.deleteMany({
    where: {
      userId: {
        in: testUserIds,
      },
    },
  });
}

describe("Calendar PostgreSQL integration", () => {
  beforeAll(async () => {
    assertTestDatabaseSafety();

    const database = await prisma.$queryRaw<
      Array<{ database: string }>
    >(
      Prisma.sql`
        SELECT current_database() AS "database"
      `,
    );

    expect(database).toEqual([
      {
        database: "brainos_test",
      },
    ]);

    const precheck = await prisma.$queryRaw<
      Array<{
        calendarEventTable: string | null;
        userTable: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          to_regclass('public."CalendarEvent"')::text AS "calendarEventTable",
          to_regclass('public."User"')::text AS "userTable"
      `,
    );

    expect(precheck).toEqual([
      {
        calendarEventTable: '"CalendarEvent"',
        userTable: '"User"',
      },
    ]);

    await cleanupIntegrationRows();

    assertTestDatabaseSafety();

    await prisma.user.upsert({
      where: {
        id: userA.id,
      },
      update: {
        clerkId: userA.clerkId,
        email: userA.email,
        firstName: "Calendar",
        lastName: "User A",
        imageUrl: null,
      },
      create: {
        ...userA,
        firstName: "Calendar",
        lastName: "User A",
        imageUrl: null,
      },
    });

    await prisma.user.upsert({
      where: {
        id: userB.id,
      },
      update: {
        clerkId: userB.clerkId,
        email: userB.email,
        firstName: "Calendar",
        lastName: "User B",
        imageUrl: null,
      },
      create: {
        ...userB,
        firstName: "Calendar",
        lastName: "User B",
        imageUrl: null,
      },
    });
  });

  beforeEach(async () => {
    await cleanupIntegrationRows();
  });

  afterAll(async () => {
    await cleanupIntegrationRows();

    assertTestDatabaseSafety();

    await prisma.user.deleteMany({
      where: {
        id: {
          in: testUserIds,
        },
      },
    });
  });

  describe("create and findByIdForUser", () => {
    it("creates an event with defaults and verifies ownership isolation", async () => {
      const event = await calendarRepository.create({
        userId: userA.id,
        title: "Team Retrospective",
        description: "Sprint retro discussion",
        location: "Room 404",
        startTime: new Date("2026-10-10T14:00:00.000Z"),
        endTime: new Date("2026-10-10T15:00:00.000Z"),
      });

      expect(event.id).toBeDefined();
      expect(event.userId).toBe(userA.id);
      expect(event.title).toBe("Team Retrospective");
      expect(event.isAllDay).toBe(false);
      expect(event.timezone).toBe("UTC");
      expect(event.status).toBe("CONFIRMED");

      // User A can find their own event
      const foundForA = await calendarRepository.findByIdForUser(
        event.id,
        userA.id,
      );
      expect(foundForA).not.toBeNull();
      expect(foundForA?.id).toBe(event.id);

      // User B CANNOT find User A's event (strictly returns null)
      const foundForB = await calendarRepository.findByIdForUser(
        event.id,
        userB.id,
      );
      expect(foundForB).toBeNull();
    });
  });

  describe("findByDateRange standard overlap rule", () => {
    it("matches events according to startTime < rangeEnd AND endTime > rangeStart with user isolation", async () => {
      const rangeStart = new Date("2026-10-15T10:00:00.000Z");
      const rangeEnd = new Date("2026-10-15T12:00:00.000Z");

      // 1. Overlaps before: 09:00 - 10:30 (starts before, ends inside) -> MATCH
      const evOverlapsStart = await calendarRepository.create({
        userId: userA.id,
        title: "Overlaps Start",
        startTime: new Date("2026-10-15T09:00:00.000Z"),
        endTime: new Date("2026-10-15T10:30:00.000Z"),
      });

      // 2. Inside range: 10:30 - 11:30 -> MATCH
      const evInside = await calendarRepository.create({
        userId: userA.id,
        title: "Inside Range",
        startTime: new Date("2026-10-15T10:30:00.000Z"),
        endTime: new Date("2026-10-15T11:30:00.000Z"),
      });

      // 3. Overlaps after: 11:30 - 13:00 (starts inside, ends after) -> MATCH
      const evOverlapsEnd = await calendarRepository.create({
        userId: userA.id,
        title: "Overlaps End",
        startTime: new Date("2026-10-15T11:30:00.000Z"),
        endTime: new Date("2026-10-15T13:00:00.000Z"),
      });

      // 4. Engulfs range: 09:00 - 13:00 (starts before, ends after) -> MATCH
      const evEngulfs = await calendarRepository.create({
        userId: userA.id,
        title: "Engulfs Range",
        startTime: new Date("2026-10-15T09:00:00.000Z"),
        endTime: new Date("2026-10-15T13:00:00.000Z"),
      });

      // 5. Abuts start boundary: 08:00 - 10:00 (endTime === rangeStart) -> NO MATCH
      await calendarRepository.create({
        userId: userA.id,
        title: "Abuts Start",
        startTime: new Date("2026-10-15T08:00:00.000Z"),
        endTime: new Date("2026-10-15T10:00:00.000Z"),
      });

      // 6. Abuts end boundary: 12:00 - 14:00 (startTime === rangeEnd) -> NO MATCH
      await calendarRepository.create({
        userId: userA.id,
        title: "Abuts End",
        startTime: new Date("2026-10-15T12:00:00.000Z"),
        endTime: new Date("2026-10-15T14:00:00.000Z"),
      });

      // 7. Completely before: 07:00 - 08:00 -> NO MATCH
      await calendarRepository.create({
        userId: userA.id,
        title: "Before Range",
        startTime: new Date("2026-10-15T07:00:00.000Z"),
        endTime: new Date("2026-10-15T08:00:00.000Z"),
      });

      // 8. Completely after: 14:00 - 15:00 -> NO MATCH
      await calendarRepository.create({
        userId: userA.id,
        title: "After Range",
        startTime: new Date("2026-10-15T14:00:00.000Z"),
        endTime: new Date("2026-10-15T15:00:00.000Z"),
      });

      // 9. User B's overlapping event: 10:30 - 11:30 -> User isolation check
      await calendarRepository.create({
        userId: userB.id,
        title: "User B Overlapping Event",
        startTime: new Date("2026-10-15T10:30:00.000Z"),
        endTime: new Date("2026-10-15T11:30:00.000Z"),
      });

      const results = await calendarRepository.findByDateRange({
        userId: userA.id,
        rangeStart,
        rangeEnd,
      });

      const matchedIds = results.map((e) => e.id);
      expect(matchedIds).toHaveLength(4);
      expect(matchedIds).toContain(evOverlapsStart.id);
      expect(matchedIds).toContain(evInside.id);
      expect(matchedIds).toContain(evOverlapsEnd.id);
      expect(matchedIds).toContain(evEngulfs.id);

      // Results must be ordered by startTime ascending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.startTime.getTime()).toBeLessThanOrEqual(
          results[i + 1]!.startTime.getTime(),
        );
      }
    });
  });

  describe("findUpcoming", () => {
    it("returns future events for the user in ascending order", async () => {
      const pastTime = new Date("2026-08-01T10:00:00.000Z");
      const future1 = new Date("2026-11-01T10:00:00.000Z");
      const future2 = new Date("2026-11-05T10:00:00.000Z");

      // Past event
      await calendarRepository.create({
        userId: userA.id,
        title: "Past Event",
        startTime: pastTime,
        endTime: new Date("2026-08-01T11:00:00.000Z"),
      });

      // Future event 2
      const evFuture2 = await calendarRepository.create({
        userId: userA.id,
        title: "Future 2",
        startTime: future2,
        endTime: new Date("2026-11-05T11:00:00.000Z"),
      });

      // Future event 1
      const evFuture1 = await calendarRepository.create({
        userId: userA.id,
        title: "Future 1",
        startTime: future1,
        endTime: new Date("2026-11-01T11:00:00.000Z"),
      });

      // User B future event
      await calendarRepository.create({
        userId: userB.id,
        title: "User B Future",
        startTime: future1,
        endTime: new Date("2026-11-01T11:00:00.000Z"),
      });

      const upcoming = await calendarRepository.findUpcoming({
        userId: userA.id,
        from: new Date("2026-09-01T00:00:00.000Z"),
      });

      expect(upcoming).toHaveLength(2);
      expect(upcoming[0]?.id).toBe(evFuture1.id);
      expect(upcoming[1]?.id).toBe(evFuture2.id);
    });
  });

  describe("updateForUser ownership enforcement", () => {
    it("updates an event owned by user", async () => {
      const event = await calendarRepository.create({
        userId: userA.id,
        title: "Original Title",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
      });

      const updated = await calendarRepository.updateForUser(
        event.id,
        userA.id,
        {
          title: "New Title",
          status: "TENTATIVE" as CalendarEventStatus,
        },
      );

      expect(updated.title).toBe("New Title");
      expect(updated.status).toBe("TENTATIVE");

      const inDb = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
      });
      expect(inDb?.title).toBe("New Title");
      expect(inDb?.status).toBe("TENTATIVE");
    });

    it("denies cross-user update at the database query level without modifying the record", async () => {
      const event = await calendarRepository.create({
        userId: userA.id,
        title: "Protected Title",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
      });

      // User B attempts to update User A's event
      await expect(
        calendarRepository.updateForUser(event.id, userB.id, {
          title: "Attacker Modified Title",
        }),
      ).rejects.toThrow(NotFoundError);

      // Verify User A's event in DB was NOT changed
      const inDb = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
      });
      expect(inDb?.title).toBe("Protected Title");
    });
  });

  describe("deleteForUser ownership enforcement", () => {
    it("deletes an owned event", async () => {
      const event = await calendarRepository.create({
        userId: userA.id,
        title: "Event to Delete",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
      });

      await calendarRepository.deleteForUser(event.id, userA.id);

      const inDb = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
      });
      expect(inDb).toBeNull();
    });

    it("denies cross-user delete at the database query level without deleting the record", async () => {
      const event = await calendarRepository.create({
        userId: userA.id,
        title: "Event Not Yours",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
      });

      // User B attempts to delete User A's event
      await expect(
        calendarRepository.deleteForUser(event.id, userB.id),
      ).rejects.toThrow(NotFoundError);

      // Verify User A's event is STILL in the database
      const inDb = await prisma.calendarEvent.findUnique({
        where: { id: event.id },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.title).toBe("Event Not Yours");
    });
  });

  describe("status values (CONFIRMED, TENTATIVE, CANCELLED)", () => {
    it("stores and filters each status value", async () => {
      const t1 = new Date("2026-12-01T10:00:00.000Z");
      const t2 = new Date("2026-12-01T11:00:00.000Z");

      const confirmed = await calendarRepository.create({
        userId: userA.id,
        title: "Confirmed Event",
        status: "CONFIRMED",
        startTime: t1,
        endTime: t2,
      });

      const tentative = await calendarRepository.create({
        userId: userA.id,
        title: "Tentative Event",
        status: "TENTATIVE",
        startTime: t1,
        endTime: t2,
      });

      const cancelled = await calendarRepository.create({
        userId: userA.id,
        title: "Cancelled Event",
        status: "CANCELLED",
        startTime: t1,
        endTime: t2,
      });

      expect(confirmed.status).toBe("CONFIRMED");
      expect(tentative.status).toBe("TENTATIVE");
      expect(cancelled.status).toBe("CANCELLED");

      // Filter by CANCELLED
      const cancelledList = await calendarRepository.findByDateRange({
        userId: userA.id,
        rangeStart: new Date("2026-12-01T00:00:00.000Z"),
        rangeEnd: new Date("2026-12-02T00:00:00.000Z"),
        status: "CANCELLED",
      });

      expect(cancelledList).toHaveLength(1);
      expect(cancelledList[0]?.id).toBe(cancelled.id);

      // Filter by TENTATIVE
      const tentativeList = await calendarRepository.findByDateRange({
        userId: userA.id,
        rangeStart: new Date("2026-12-01T00:00:00.000Z"),
        rangeEnd: new Date("2026-12-02T00:00:00.000Z"),
        status: "TENTATIVE",
      });

      expect(tentativeList).toHaveLength(1);
      expect(tentativeList[0]?.id).toBe(tentative.id);
    });
  });
});
