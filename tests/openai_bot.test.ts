import { describe, test, expect, mock } from "bun:test"
import { BotMessage, OpenAIBot, UserMessage, OpenAIFunction, UnnamedFunctionError } from "../src/colloquy"
import type { EasyInputMessage, Tool } from "openai/resources/responses/responses.mjs"
import { parameter_names, type Parameter } from "../src/openai_bot"


class MockOpenAIBot extends OpenAIBot {
  constructor(...args: ConstructorParameters<typeof OpenAIBot>) {
    super(...args)
    this.mock_response("")
  }

  last_created?: {
    model: string,
    input: EasyInputMessage[]
    tools?: Tool[]
  }
  mock_response(output_text: string) {
    // @ts-ignore: Getting the types to match properly is too painful to contemplate
    this.openai.responses.create = mock(async (value) => {
      this.last_created = value
      return { output_text }
    })
  }
}

test("create a simple openai bot", async () => {
  const bot = new MockOpenAIBot()
  const response = "Hi!"
  bot.mock_response(response)
  expect(await bot.prompt("hello")).toEqual(response)
})

test("includes history of previous prompts", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response("Hi!")
  await bot.prompt("hello")
  expect(bot.history).toEqual([new UserMessage("hello"), new BotMessage("Hi!")])
})

test("sends instructions as a system message", async () => {
  const bot = new MockOpenAIBot({ instructions: "something" })
  bot.mock_response("Hi!")
  await bot.prompt("hello")
  expect(bot.last_created).toEqual({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: "something",
      },
      {
        role: "user",
        content: "hello",
      },
    ],
  })
})

test("excludes system message when instructions are absent", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response("hi")
  await bot.prompt("hi")
  expect(bot.last_created!.input.map((i) => i.role)).not.toContain("system")
})

test("includes history in subsequent prompts", async () => {
  const bot = new MockOpenAIBot()
  bot.mock_response("Hello, how are you?")
  await bot.prompt("Hi!")
  bot.mock_response("That's nice")
  await bot.prompt("Good")
  expect(bot.last_created!.input.map((i) => i.content)).toEqual([
    "Hi!",
    "Hello, how are you?",
    "Good",
  ])
})

describe("functions", () => {
  test("the provided function is provided as a tool", async () => {
    const fn = new OpenAIFunction(() => {}, {
      name: "test",
    })
    const bot = new MockOpenAIBot({
      functions: [fn],
    })
    await bot.prompt("test")
    expect(bot.last_created!.tools).toEqual([{
      type: "function",
      name: fn.name,
      parameters: {},
      strict: true,
    }])
  })

  test("an unnamed anonymous function throws an error", () => {
    expect(() => new OpenAIFunction(() => {})).toThrow(new UnnamedFunctionError())
    expect(() => new OpenAIFunction(function () {})).toThrow(UnnamedFunctionError)
  })

  test("the name of a function is used", () => {
    const fn = new OpenAIFunction(function test() {})
    expect(fn.tool.name).toEqual("test")
  })

  test("a description is included", () => {
    const fn = new OpenAIFunction(function test() {}, {
      description: "a test function",
    })

    expect(fn.tool.description).toEqual("a test function")
  })

  test("a parameter is included", () => {
    const fn = new OpenAIFunction(function test(_a: unknown) {})
    expect(fn.tool.parameters["_a"]).toEqual({ type: "any" })
  })

  test("excludes spaces when extracting function names", () => {
    expect(parameter_names((_a: any, _b: any) => {})).toEqual({
      _a: { type: "any" },
      _b: { type: "any" },
    })
  })

  test("handles default parameters", () => {
    expect(parameter_names((_a: any, _b = true, _c = 1) => {}))
      .toEqual({
        _a: { type: "any" },
        _b: { type: "boolean" },
        _c: { type: "number" },
      })
  })

  test("attaches provided information", () => {
    const fn = new OpenAIFunction(function test(_a: unknown) {}, {
      parameters: { "_a": { type: "string" }}
    })
    expect(fn.tool.parameters["_a"]).toEqual({ type: "string" })
  })

  test("detects an object correctly", () => {
    const fn = new OpenAIFunction(function test(_a = { foo: 1 }) {})
    const param = fn.tool.parameters["_a"] as Parameter
    expect(param.type).toEqual("object")
    expect(param.properties).toEqual({
      foo: { type: "number" }
    })
  })

  test("detects a nested object correctly", () => {
    const fn = new OpenAIFunction(function test(_a = { foo: { bar: 1 } }) {})
    const param = fn.tool.parameters["_a"] as Parameter
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
    const fn = new OpenAIFunction(function test(_null = null) {})
    expect((fn.tool.parameters["_null"] as Parameter).type)
      .toEqual("null")
  })

  test("provided description is included", () => {
    const description = "first test parameter"
    const fn = new OpenAIFunction(function test(_a = 1) {}, { parameters: {
      _a: { description }
    } })
    const param = fn.tool.parameters["_a"] as Parameter
    expect(param.description).toEqual(description)
    expect(param.type).toEqual("number")
  })

  test("nested parameters are augmented", () => {
    const description = "first test parameter"
    const fn = new OpenAIFunction(function test(_a = {
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
        fn.tool.parameters["_a"] as Parameter
      ).properties!["b"] as Parameter
    ).properties!["c"] as Parameter
    expect(param.description).toEqual(description)
    expect(param.type).toEqual("number")
  })

  // TODO: commas in nested definitions
})
