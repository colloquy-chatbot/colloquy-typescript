import { describe, test, expect } from "bun:test"
import { FunctionCallMessage } from "../../src/openai/message"
import { PromptFunction } from "../../src/function"

describe("FunctionCallMessage", () => {
  test("invoked function called with parameter", async () => {
    let input = ""
    const fn = new FunctionCallMessage(
      new PromptFunction(function test(a = "a") {
        input = a
      }),
      {
        arguments: '{ "a": "b" }',
        call_id: "12345",
        name: "test",
        type: "function_call",
      },
    )
    await fn.invoke()
    expect(input).toEqual("b")
  })

  test("invoked function called with parameter", () => {
    const fn = new FunctionCallMessage(
      new PromptFunction(function test_fn(_a = "a") {}),
      {
        arguments: '{ "a": "b" }',
        call_id: "54321",
        name: "test_fn",
        type: "function_call",
      },
    )

    expect(fn.input).toEqual({
      arguments: '{ "a": "b" }',
      call_id: "54321",
      name: "test_fn",
      type: "function_call",
    })
  })

  test("invoked function called with correct input", async () => {
    const fn = new FunctionCallMessage(
      new PromptFunction(function test_fn(_a = "a") { return "foo" }),
      {
        arguments: '{ "_a": "b" }',
        call_id: "54321",
        name: "test_fn",
        type: "function_call",
      },
    )

    const result = await fn.invoke()
    expect(result.input).toEqual({
      type: "function_call_output",
      call_id: "54321",
      output: "foo",
    })
  })

  test("functions with undefined results still produce output", async () => {
    const fn = new FunctionCallMessage(
      new PromptFunction(function test() {}),
      {
        arguments: "{}",
        call_id: "1",
        name: "test",
        type: "function_call",
      },
    )

    const result = await fn.invoke()
    expect(result.input.output).toEqual("")
  })
})
