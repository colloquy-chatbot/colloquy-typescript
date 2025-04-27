import { describe, test, expect } from "bun:test"
import { FunctionCallMessage } from "../../src/openai/message"
import { PromptFunction } from "../../src/function"
import type { ResponseInputItem } from "openai/resources/responses/responses.mjs"

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
    await fn.invoke_fn()
    expect(input).toEqual("b")
  })

  test("invoked function called with parameter", async () => {
    const fn = new FunctionCallMessage(
      new PromptFunction(function test_fn(_a = "a") {}),
      {
        arguments: '{ "a": "b" }',
        call_id: "54321",
        name: "test_fn",
        type: "function_call",
      },
    )

    expect((await fn.input())[0]).toEqual({
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

    const input = await fn.input()
    expect(input[1]).toEqual({
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

    const input = await fn.input()
    expect((input[1] as ResponseInputItem.FunctionCallOutput).output).toEqual("")
  })
})
