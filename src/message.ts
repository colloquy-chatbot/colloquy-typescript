import type { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses.mjs"
import type { PromptFunction } from "./function"

export abstract class Message {
  abstract get input(): ResponseInputItem

  protected input_item(role: "user" | "system" | "assistant", content: string): ResponseInputItem {
    return { role, content }
  }
}

export class SystemMessage extends Message {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }

  get input(): ResponseInputItem {
    return this.input_item("system", this.text)
  }
}

export class UserMessage extends Message {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }

  get input(): ResponseInputItem {
    return this.input_item("user", this.text)
  }
}

export class BotMessage extends Message {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }

  get input(): ResponseInputItem {
    return this.input_item("assistant", this.text)
  }
}

export class FunctionCallMessage<T> extends Message {
  fn: PromptFunction<T>
  tool_call: ResponseFunctionToolCall
  constructor(fn: PromptFunction<T>, tool_call: ResponseFunctionToolCall) {
    super()
    this.fn = fn
    this.tool_call = tool_call
  }

  get input(): ResponseInputItem {
    return this.tool_call
  }

  async invoke(): Promise<FunctionResultMessage> {
    return new FunctionResultMessage(
      this.tool_call.call_id,
      await this.fn.invoke(JSON.parse(this.tool_call.arguments))
    )
  }
}

export class FunctionResultMessage extends Message {
  call_id: string
  output: string
  constructor(call_id: string, output: string) {
    super()
    this.call_id = call_id
    this.output = output
  }

  get input(): ResponseInputItem {
    return {
      type: "function_call_output",
      call_id: this.call_id,
      output: this.output,
    }
  }
}
