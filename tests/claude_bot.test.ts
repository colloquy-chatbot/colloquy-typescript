import { describe, test, expect, type Mock } from "bun:test";
import { ClaudeBot } from "../src/claude_bot";
import { mock_multiple_return_values, mock_requests } from "./utils";
import type {
  ContentBlock,
  Message,
  MessageParam,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { PromptFunction } from "../src/function";
import { RoleMessage } from "../src/message";
import { FunctionCallMessage } from "../src/claude/message";

class MockClaudeBot extends ClaudeBot {
  mock!: Mock<any>;
  constructor(...args: ConstructorParameters<typeof ClaudeBot>) {
    super(...args);
    this.mock_response_text("");
  }

  get messages(): any[] {
    return mock_requests(this.mock);
  }

  mock_response_text(text: string) {
    this.mock_content([[this.text_content(text)]]);
  }

  text_content(text: string): TextBlock {
    return {
      type: "text",
      text,
      citations: null,
    };
  }

  mock_content(content_list: ContentBlock[][]) {
    this.mock_responses(
      content_list.map((content) => this.build_response(content)),
    );
  }

  build_response(
    content: ContentBlock[],
    { stop_reason = "end_turn" }: Partial<Message> = {},
  ) {
    return {
      id: "msg_01MjsWDNTvZmFDAp7SQfY8im",
      type: "message",
      role: "assistant",
      model: "claude-3-7-sonnet-20250219",
      content: content,
      stop_reason,
      stop_sequence: null,
      usage: {
        input_tokens: 8,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 26,
      },
    };
  }

  mock_responses<T>(responses: T[]) {
    this.mock = mock_multiple_return_values(responses);
    this.client.messages.create = this.mock;
  }
}

test("create a simple bot", async () => {
  const bot = new MockClaudeBot();
  bot.mock_response_text("Hello, how are you");
  const response = await bot.prompt("Hi");
  expect(response).toEqual("Hello, how are you");
});

test("sends instructions as a system parameter", async () => {
  const bot = new MockClaudeBot({ instructions: "Be helpful" });
  await bot.prompt("Hi");
  expect(bot.messages.at(-1).system).toEqual("Be helpful");
});

test("includes history in subsequent prompts", async () => {
  const bot = new MockClaudeBot();
  bot.mock_response_text("Hello, how are you?");
  await bot.prompt("Hi!");
  bot.mock_response_text("That's nice");
  await bot.prompt("Good");
  expect(
    bot.messages.at(-1)!.messages.map((i: MessageParam) => i.content),
  ).toEqual(["Hi!", "Hello, how are you?", "Good"]);
});

describe("functions", () => {
  test("the provided function is provided as a tool", async () => {
    const fn = new PromptFunction(function test(_foo = "foo") {}, {
      description: "Something cool",
      parameters: {
        _foo: { description: "a string" },
      },
    });
    const bot = new MockClaudeBot({
      functions: [fn],
    });
    await bot.prompt("test");
    expect(bot.messages.at(-1)!.tools).toEqual([
      {
        name: "test",
        description: "Something cool",
        input_schema: {
          type: "object",
          properties: {
            _foo: {
              type: "string",
              description: "a string",
            },
          },
          required: ["_foo"],
        },
      },
    ]);
  });

  test("calls a function when AI requests it", async () => {
    let input = 0;
    const fn = new PromptFunction(function test(foo = 1) {
      input = foo;
      return "test";
    });
    const bot = new MockClaudeBot({ functions: [fn] });

    const tool_use: ToolUseBlock = {
      type: "tool_use",
      id: "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
      name: "test",
      input: { foo: 2 },
    };

    bot.mock_responses([
      bot.build_response(
        [
          {
            type: "text",
            text: "I'll call the test function as you requested.",
            citations: null,
          },
          tool_use,
        ],
        { stop_reason: "tool_use" },
      ),
      bot.build_response([bot.text_content("Hello")]),
    ]);

    await bot.prompt("hi");
    expect(input).toEqual(2);

    expect(bot.messages.map((m) => m.messages)).toEqual([
      [
        {
          content: "hi",
          role: "user",
        },
      ],
      [
        {
          content: "hi",
          role: "user",
        },
        {
          content: "I'll call the test function as you requested.",
          role: "assistant",
        },
        {
          content: [tool_use],
          role: "assistant",
        },
        {
          content: [
            {
              type: "tool_result",
              tool_use_id: tool_use.id,
              content: "test",
            },
          ],
          role: "user",
        },
      ],
    ]);

    expect(bot.history).toEqual([
      new RoleMessage("user", "hi"),
      new RoleMessage(
        "assistant",
        "I'll call the test function as you requested.",
      ),
      new FunctionCallMessage(fn, tool_use, "test"),
      new RoleMessage("assistant", "Hello"),
    ]);
  });
});
