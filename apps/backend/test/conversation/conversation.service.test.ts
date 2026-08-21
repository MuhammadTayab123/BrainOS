import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../src/errors";
import { ConversationService } from "../../src/services/conversation/conversation.service";

const fakes = {
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
};

function createService() {
  return new ConversationService({
    create: fakes.create,
    listByUser: fakes.listByUser,
    findByIdForUser: fakes.findByIdForUser,
    softDeleteByIdForUser: fakes.softDeleteByIdForUser,
  } as any);
}

const conversation = {
  id: "conversation-a",
  title: "First conversation",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ConversationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.create.mockResolvedValue(conversation);
    fakes.listByUser.mockResolvedValue([conversation]);
    fakes.findByIdForUser.mockResolvedValue(conversation);
    fakes.softDeleteByIdForUser.mockResolvedValue(undefined);
  });

  describe("createConversation", () => {
    it("creates an owner-scoped conversation", async () => {
      const service = createService();

      const result = await service.createConversation({
        userId: "user-a",
        title: "  First conversation  ",
      });

      expect(result).toEqual(conversation);
      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "First conversation",
      });
    });

    it("allows a conversation without a title", async () => {
      const service = createService();

      await service.createConversation({
        userId: "user-a",
      });

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: undefined,
      });
    });

    it("rejects an empty user id", async () => {
      const service = createService();

      await expect(
        service.createConversation({
          userId: "   ",
        }),
      ).rejects.toThrow(
        "User ID is required to create a conversation.",
      );

      expect(fakes.create).not.toHaveBeenCalled();
    });
  });

  describe("listConversations", () => {
    it("lists conversations for the authenticated user", async () => {
      const service = createService();

      const result = await service.listConversations({
        userId: "user-a",
      });

      expect(result).toEqual([conversation]);
      expect(fakes.listByUser).toHaveBeenCalledWith(
        "user-a",
        20,
      );
    });

    it("accepts a custom valid limit", async () => {
      const service = createService();

      await service.listConversations({
        userId: "user-a",
        limit: 50,
      });

      expect(fakes.listByUser).toHaveBeenCalledWith(
        "user-a",
        50,
      );
    });

    it.each([0, -1, 1.5, 101])(
      "rejects invalid limit %s",
      async (limit) => {
        const service = createService();

        await expect(
          service.listConversations({
            userId: "user-a",
            limit,
          }),
        ).rejects.toThrow();

        expect(fakes.listByUser).not.toHaveBeenCalled();
      },
    );
  });

  describe("getConversation", () => {
    it("returns an owner-scoped conversation", async () => {
      const service = createService();

      const result = await service.getConversation({
        conversationId: "conversation-a",
        userId: "user-a",
      });

      expect(result).toEqual(conversation);
      expect(fakes.findByIdForUser).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );
    });

    it("does not expose a conversation that is not owned by the user", async () => {
      const service = createService();

      fakes.findByIdForUser.mockResolvedValueOnce(null);

      await expect(
        service.getConversation({
          conversationId: "conversation-b",
          userId: "user-a",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(fakes.findByIdForUser).toHaveBeenCalledWith(
        "conversation-b",
        "user-a",
      );
    });

    it("rejects a missing conversation id", async () => {
      const service = createService();

      await expect(
        service.getConversation({
          conversationId: "   ",
          userId: "user-a",
        }),
      ).rejects.toThrow("Conversation ID is required.");

      expect(fakes.findByIdForUser).not.toHaveBeenCalled();
    });
  });

  describe("deleteConversation", () => {
    it("soft-deletes an owner-scoped conversation", async () => {
      const service = createService();

      await service.deleteConversation({
        conversationId: "conversation-a",
        userId: "user-a",
      });

      expect(
        fakes.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );
    });

    it("propagates not-found errors from the repository", async () => {
      const service = createService();

      fakes.softDeleteByIdForUser.mockRejectedValueOnce(
        new NotFoundError(
          "Conversation not found for the authenticated user.",
        ),
      );

      await expect(
        service.deleteConversation({
          conversationId: "conversation-b",
          userId: "user-a",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});