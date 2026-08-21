import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../src/errors";
import { MessageService } from "../../src/services/conversation/message.service";

const fakes = {
  create: vi.fn(),
  listByConversation: vi.fn(),
  findByIdForUser: vi.fn(),
};

function createService() {
  return new MessageService(
    {
      create: fakes.create,
      listByConversation: fakes.listByConversation,
    } as any,
    {
      findByIdForUser: fakes.findByIdForUser,
    } as any,
  );
}

const message = {
  id: "message-a",
  conversationId: "conversation-a",
  role: "USER",
  content: "Hello BrainOS",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const conversation = {
  id: "conversation-a",
  title: "Test conversation",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("MessageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.findByIdForUser.mockResolvedValue(conversation);
    fakes.create.mockResolvedValue(message);
    fakes.listByConversation.mockResolvedValue([message]);
  });

  describe("createMessage", () => {
    it("creates a message inside an owner-scoped conversation", async () => {
      const service = createService();

      const result = await service.createMessage({
        conversationId: "conversation-a",
        userId: "user-a",
        role: "USER",
        content: "  Hello BrainOS  ",
      });

      expect(result).toEqual(message);

      expect(fakes.findByIdForUser).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );

      expect(fakes.create).toHaveBeenCalledWith({
        conversationId: "conversation-a",
        role: "USER",
        content: "Hello BrainOS",
      });
    });

    it("rejects a conversation that does not belong to the user", async () => {
      const service = createService();

      fakes.findByIdForUser.mockResolvedValueOnce(null);

      await expect(
        service.createMessage({
          conversationId: "conversation-b",
          userId: "user-a",
          role: "USER",
          content: "Hello",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(fakes.create).not.toHaveBeenCalled();
    });

    it("rejects empty content", async () => {
      const service = createService();

      await expect(
        service.createMessage({
          conversationId: "conversation-a",
          userId: "user-a",
          role: "USER",
          content: "   ",
        }),
      ).rejects.toThrow("Message content is required.");

      expect(fakes.findByIdForUser).not.toHaveBeenCalled();
      expect(fakes.create).not.toHaveBeenCalled();
    });
  });

  describe("listMessages", () => {
    it("lists messages only after verifying conversation ownership", async () => {
      const service = createService();

      const result = await service.listMessages({
        conversationId: "conversation-a",
        userId: "user-a",
      });

      expect(result).toEqual([message]);

      expect(fakes.findByIdForUser).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );

      expect(fakes.listByConversation).toHaveBeenCalledWith(
        "conversation-a",
      );
    });

    it("does not expose messages from another user's conversation", async () => {
      const service = createService();

      fakes.findByIdForUser.mockResolvedValueOnce(null);

      await expect(
        service.listMessages({
          conversationId: "conversation-b",
          userId: "user-a",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(fakes.listByConversation).not.toHaveBeenCalled();
    });
  });
});
