import { describe, expect, it } from "bun:test";
import { MockBot } from "../src/mock_bot";
import { SimpleMessage } from "../src/message";

describe("MockBot", () => {
  it("can be instantiated with default settings", () => {
    const bot = new MockBot();
    expect(bot).toBeDefined();
    expect(bot.instructions).toBeUndefined();
    expect(bot.history).toEqual([]);
    expect(bot.debug).toBe(false);
  });

  it("can be instantiated with custom settings", () => {
    const bot = new MockBot({
      instructions: "Test instructions",
      debug: true,
      defaultResponse: "Custom default response",
    });
    expect(bot.instructions).toBe("Test instructions");
    expect(bot.debug).toBe(true);
  });

  it("returns default response when no specific responses are configured", async () => {
    const bot = new MockBot({ defaultResponse: "Test default" });
    const response = await bot.prompt("Hello");
    expect(response).toBe("Test default");
  });

  it("returns configured responses in sequence", async () => {
    const bot = new MockBot({
      responses: ["First response", "Second response", "Third response"],
    });

    expect(await bot.prompt("Message 1")).toBe("First response");
    expect(await bot.prompt("Message 2")).toBe("Second response");
    expect(await bot.prompt("Message 3")).toBe("Third response");
  });

  it("falls back to default response after configured responses are exhausted", async () => {
    const bot = new MockBot({
      responses: ["First response"],
      defaultResponse: "Default response",
    });

    expect(await bot.prompt("Message 1")).toBe("First response");
    expect(await bot.prompt("Message 2")).toBe("Default response");
    expect(await bot.prompt("Message 3")).toBe("Default response");
  });

  it("can add individual responses", () => {
    const bot = new MockBot();
    bot.addResponse("Added response");

    expect(bot.prompt("Test")).resolves.toBe("Added response");
  });

  it("can add multiple responses at once", async () => {
    const bot = new MockBot();
    bot.addResponses(["Response 1", "Response 2", "Response 3"]);

    expect(await bot.prompt("Test 1")).toBe("Response 1");
    expect(await bot.prompt("Test 2")).toBe("Response 2");
    expect(await bot.prompt("Test 3")).toBe("Response 3");
  });

  it("can change the default response", async () => {
    const bot = new MockBot({ defaultResponse: "Original default" });
    bot.setDefaultResponse("New default");

    const response = await bot.prompt("Test");
    expect(response).toBe("New default");
  });

  it("maintains conversation history", async () => {
    const bot = new MockBot({
      responses: ["Hello there!", "How can I help you?"],
    });

    await bot.prompt("Hi");
    await bot.prompt("What can you do?");

    expect(bot.history).toHaveLength(4); // 2 user messages + 2 bot responses
    expect(bot.history[0].text).toBe("Hi");
    expect(bot.history[1].text).toBe("Hello there!");
    expect(bot.history[2].text).toBe("What can you do?");
    expect(bot.history[3].text).toBe("How can I help you?");
  });

  it("can reset the conversation", async () => {
    const bot = new MockBot({
      responses: ["Response 1", "Response 2"],
    });

    await bot.prompt("Message 1");
    await bot.prompt("Message 2");

    expect(bot.history).toHaveLength(4);

    bot.reset();

    expect(bot.history).toHaveLength(0);
    // Should also reset response index
    expect(await bot.prompt("New message")).toBe("Response 1");
  });

  it("can reset responses", async () => {
    const bot = new MockBot({
      responses: ["Response 1", "Response 2"],
      defaultResponse: "Default",
    });

    expect(await bot.prompt("Message 1")).toBe("Response 1");

    bot.resetResponses();

    expect(await bot.prompt("Message 2")).toBe("Default");
  });

  it("can be initialized with existing history", () => {
    const existingHistory = [
      new SimpleMessage("Previous user message"),
      new SimpleMessage("Previous bot response"),
    ];

    const bot = new MockBot({ history: existingHistory });

    expect(bot.history).toHaveLength(2);
    expect(bot.history[0].text).toBe("Previous user message");
    expect(bot.history[1].text).toBe("Previous bot response");
  });

  it("works correctly when mixing constructor responses with added responses", async () => {
    const bot = new MockBot({
      responses: ["Constructor response"],
    });

    bot.addResponse("Added response");

    expect(await bot.prompt("Message 1")).toBe("Constructor response");
    expect(await bot.prompt("Message 2")).toBe("Added response");
  });

  it("has a working message factory", () => {
    const bot = new MockBot();
    const factory = bot.message_factory;

    const userMessage = factory.user("Test message");
    expect(userMessage.text).toBe("Test message");

    const deserializedMessage = factory.deserialize("Deserialized message");
    expect(deserializedMessage.text).toBe("Deserialized message");
  });

  describe("Error handling", () => {
    it("can throw errors when configured with Error responses", async () => {
      const error = new Error("Test error");
      const bot = new MockBot({
        responses: [error],
      });

      await expect(bot.prompt("Test")).rejects.toThrow("Test error");
    });

    it("can mix string and Error responses", async () => {
      const error = new Error("API error");
      const bot = new MockBot({
        responses: ["Success", error, "Recovery"],
      });

      expect(await bot.prompt("Test 1")).toBe("Success");
      await expect(bot.prompt("Test 2")).rejects.toThrow("API error");
      expect(await bot.prompt("Test 3")).toBe("Recovery");
    });

    it("can throw default error when responses are exhausted", async () => {
      const defaultError = new Error("Default error");
      const bot = new MockBot({
        responses: ["One response"],
        defaultResponse: defaultError,
      });

      expect(await bot.prompt("Test 1")).toBe("One response");
      await expect(bot.prompt("Test 2")).rejects.toThrow("Default error");
      await expect(bot.prompt("Test 3")).rejects.toThrow("Default error");
    });

    it("can add individual errors", async () => {
      const bot = new MockBot();
      const error = new Error("Added error");
      
      bot.addError(error);
      
      await expect(bot.prompt("Test")).rejects.toThrow("Added error");
    });

    it("can add multiple errors", async () => {
      const bot = new MockBot();
      const errors = [new Error("Error 1"), new Error("Error 2")];
      
      bot.addErrors(errors);
      
      await expect(bot.prompt("Test 1")).rejects.toThrow("Error 1");
      await expect(bot.prompt("Test 2")).rejects.toThrow("Error 2");
    });

    it("can set default error", async () => {
      const bot = new MockBot();
      const defaultError = new Error("Default API error");
      
      bot.setDefaultError(defaultError);
      
      await expect(bot.prompt("Test")).rejects.toThrow("Default API error");
    });

    it("can add mixed responses and errors", async () => {
      const bot = new MockBot();
      const error = new Error("Mixed error");
      
      bot.addResponse("Success");
      bot.addError(error);
      bot.addResponse("Final response");
      
      expect(await bot.prompt("Test 1")).toBe("Success");
      await expect(bot.prompt("Test 2")).rejects.toThrow("Mixed error");
      expect(await bot.prompt("Test 3")).toBe("Final response");
    });

    it("maintains history even when errors are thrown", async () => {
      const error = new Error("Test error");
      const bot = new MockBot({
        responses: ["Success", error],
      });

      expect(await bot.prompt("Message 1")).toBe("Success");
      
      try {
        await bot.prompt("Message 2");
      } catch (e) {
        // Expected error
      }

      // History should contain both user messages, but only one bot response
      expect(bot.history).toHaveLength(3); // user1, bot1, user2
      expect(bot.history[0].text).toBe("Message 1");
      expect(bot.history[1].text).toBe("Success");
      expect(bot.history[2].text).toBe("Message 2");
    });
  });
});
