import { describe, test, expect, type Mock } from "bun:test"
import { OpenAIBot, PromptFunction, UnnamedFunctionError } from "../src/colloquy"
import type { EasyInputMessage, ResponseFunctionToolCall, ResponseInputItem, Tool } from "openai/resources/responses/responses.mjs"
import { FunctionCallMessage, FunctionResultMessage, ReasoningMessage } from "../src/openai/message"
import { parameters_for, type Parameter } from "../src/function"
import { mock_multiple_return_values, mock_requests } from "./utils"
import { tool } from "../src/openai/function"
import { RoleMessage } from "../src/message"

class MockOpenAIBot extends OpenAIBot {
  mock!: Mock<any>
  constructor(...args: ConstructorParameters<typeof OpenAIBot>) {
    super(...args)
    this.mock_response_text("")
  }

  get requests(): {
    model: string,
    input: ResponseInputItem[]
    tools?: Tool[]
  }[] {
    return mock_requests(this.mock)
  }

  mock_response_text(output_text: string) {
    this.mock_responses([this.text_response(output_text)])
  }

  text_response(output_text: string): any {
    return {
      output_text,
      output: [{
        type: "message",
        status: "completed",
      }],
    }
  }

  mock_responses(responses: any[]) {
    this.mock = mock_multiple_return_values(responses)
    this.openai.responses.create = this.mock
  }
}

test("create a simple openai bot", async () => {
  const bot = new MockOpenAIBot()
  const response = "Hi!"
  bot.mock_response_text(response)
  expect(await bot.prompt("hello")).toEqual(response)
})

test("includes history of previous prompts", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response_text("Hi!")
  await bot.prompt("hello")
  expect(bot.history).toEqual([new RoleMessage("user", "hello"), new RoleMessage("assistant", "Hi!")])
})

test("sends instructions as a system message", async () => {
  const bot = new MockOpenAIBot({ instructions: "something" })
  bot.mock_response_text("Hi!")
  await bot.prompt("hello")
  expect(bot.requests.at(-1)!.input).toEqual([
    {
      role: "system",
      content: "something",
    },
    {
      role: "user",
      content: "hello",
    },
  ])
})

test("excludes system message when instructions are absent", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response_text("hi")
  await bot.prompt("hi")
  expect(bot.requests.at(-1)!.input.map(
    (i) => (i as EasyInputMessage).role
  )).not.toContain("system")
})

test("includes history in subsequent prompts", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response_text("Hello, how are you?")
  await bot.prompt("Hi!")
  bot.mock_response_text("That's nice")
  await bot.prompt("Good")
  expect(bot.requests.at(-1)!.input.map(
    (i) => (i as EasyInputMessage).content
  )).toEqual([
    "Hi!",
    "Hello, how are you?",
    "Good",
  ])
})

describe("functions", () => {
  test("the provided function is provided as a tool", async () => {
    const fn = new PromptFunction(() => {}, {
      name: "test",
    })
    const bot = new MockOpenAIBot({
      functions: [fn],
    })
    await bot.prompt("test")
    expect(bot.requests.at(-1)!.tools).toEqual([{
      type: "function",
      name: tool(fn).name,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
        required: [],
      },
      strict: true,
    }])
  })

  test("an unnamed anonymous function throws an error", () => {
    expect(() => new PromptFunction(() => {})).toThrow(new UnnamedFunctionError())
    expect(() => new PromptFunction(function () {})).toThrow(UnnamedFunctionError)
  })

  test("the name of a function is used", () => {
    const fn = new PromptFunction(function test() {})
    expect(tool(fn).name).toEqual("test")
  })

  test("a description is included", () => {
    const fn = new PromptFunction(function test() {}, {
      description: "a test function",
    })

    expect(tool(fn).description).toEqual("a test function")
  })

  test("a parameter is included", () => {
    const fn = new PromptFunction(function test(_a: unknown) {})
    expect(tool(fn).parameters.properties["_a"]).toEqual({ type: "any" })
  })

  test("excludes spaces when extracting function names", () => {
    expect(parameters_for((_a: any, _b: any) => {})).toEqual([
      ["_a", { type: "any" }],
      ["_b", { type: "any" }],
    ])
  })

  test("handles default parameters", () => {
    expect(parameters_for((_a: any, _b = true, _c = 1) => {}))
      .toEqual([
        ["_a", { type: "any" }],
        ["_b", { type: "boolean" }],
        ["_c", { type: "number" }],
      ])
  })

  test("attaches provided information", () => {
    const fn = new PromptFunction(function test(_a: unknown) {}, {
      parameters: { "_a": { type: "string" }}
    })
    expect(tool(fn).parameters.properties["_a"]).toEqual({ type: "string" })
  })

  test("detects an object correctly", () => {
    const fn = new PromptFunction(function test(_a = { foo: 1 }) {})
    const param = tool(fn).parameters.properties["_a"] as Parameter
    expect(param.type).toEqual("object")
    expect(param.properties).toEqual({
      foo: { type: "number" }
    })
  })

  test("detects a nested object correctly", () => {
    const fn = new PromptFunction(function test(_a = { foo: { bar: 1 } }) {})
    const param = tool(fn).parameters.properties["_a"] as Parameter
    expect(param.type).toEqual("object")
    expect(param.properties).toEqual({
      foo: {
        type: "object",
        properties: {
          bar: { type: "number" },
        },
      },
    })
  })

  test("null parameter", () => {
    const fn = new PromptFunction(function test(_null = null) {})
    expect((tool(fn).parameters.properties["_null"] as Parameter).type)
      .toEqual("null")
  })

  test("provided description is included", () => {
    const description = "first test parameter"
    const fn = new PromptFunction(function test(_a = 1) {}, { parameters: {
      _a: { description }
    } })
    const param = tool(fn).parameters.properties["_a"] as Parameter
    expect(param.description).toEqual(description)
    expect(param.type).toEqual("number")
  })

  test("nested parameters are augmented", () => {
    const description = "first test parameter"
    const fn = new PromptFunction(function test(_a = {
      b: { c: 1 }
    }) {}, { parameters: {
      _a: {
        properties: { b: {
          properties: {
            c: { description }
          }
        } } },
    } })
    const param = (
      (
        tool(fn).parameters.properties["_a"] as Parameter
      ).properties!["b"] as Parameter
    ).properties!["c"] as Parameter
    expect(param.description).toEqual(description)
    expect(param.type).toEqual("number")
  })

  test("commas in nested definitions", () => {
    const fn = new PromptFunction(function test(_a = { b: 1, c: "foo" }) {})
    expect(Object.keys(tool(fn).parameters.properties)).toEqual(["_a"])
  })

  test("calls a function when AI requests it", async () => {
    let called = false
    const fn = new PromptFunction(function test() {
      called = true
      return "test"
    })
    const bot = new MockOpenAIBot({ functions: [fn] })

    const function_call_output: ResponseFunctionToolCall = {
      type: "function_call",
      call_id: "12345",
      name: "test",
      arguments: "{}",
    }

    bot.mock_responses([
      { output: [function_call_output] },
      bot.text_response("Hello"),
    ])

    await bot.prompt("hi")
    expect(called).toBeTrue()

    expect(bot.requests.map((r) => r.input)).toEqual([
      [
        {
          content: "hi",
          role: "user",
        }
      ],
      [
        {
          content: "hi",
          role: "user",
        },
        function_call_output,
        {
          type: "function_call_output",
          call_id: function_call_output.call_id,
          output: "test",
        }
      ],
    ])

    expect(bot.history).toEqual([
      new RoleMessage("user", "hi"),
      new FunctionCallMessage(fn, function_call_output),
      new FunctionResultMessage("12345", "test"),
      new RoleMessage("assistant", "Hello"),
    ])
  })
})

test("Includes reasoning in history", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_responses([
    {
      output_text: "Hi",
      output: [
        {
          "id": "id",
          "type": "reasoning",
          "summary": [],
        },
        {
          type: "message",
          status: "completed",
        }
      ],
    }
  ])
  await bot.prompt("Hi")
  expect(bot.history).toContainEqual(new ReasoningMessage("id", []))
})
