import { test, expect } from "bun:test"
import { FunctionCallMessage } from "../src/message"
import { PromptFunction } from "../src/function"

test("invoked function called with parameter", async () => {
  let input = ""
  const fn = new FunctionCallMessage(
    new PromptFunction(function test(a="a") {
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
