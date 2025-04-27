import type { ResponseFunctionToolCall, ResponseInputItem, ResponseReasoningItem } from "openai/resources/responses/responses.mjs"
import type { PromptFunction } from "../function"
import * as base from "../message"

type Role = "user" | "system" | "assistant"
type IM = base.InputMessage<ResponseInputItem>

export class OpenAIMessageFactory implements base.MessageFactory<IM> {
  user(text: string): base.RoleMessage<Role, ResponseInputItem> {
    return new base.RoleMessage("user", text)
  }

  deserialize(_serialized: any): IM[] {
    throw new Error("Unimplemented")
  }
}

export class FunctionCallMessage<ReturnValue> extends base.FunctionCallMessage<ReturnValue> implements base.InputMessage<ResponseInputItem> {
  tool_call: ResponseFunctionToolCall
  constructor(fn: PromptFunction<ReturnValue>, tool_call: ResponseFunctionToolCall, result?: string) {
    super(fn, result)
    this.tool_call = tool_call
  }

  get arguments() {
    return JSON.parse(this.tool_call.arguments)
  }

  async input(): Promise<ResponseInputItem[]> {
    return [
      this.tool_call,
      {
        type: "function_call_output",
        call_id: this.tool_call.call_id,
        output: await this.invoke_fn() || "",
      }
    ]
  }
}

export class ReasoningMessage implements base.InputMessage<ResponseInputItem> {
  id: string
  summary: ResponseReasoningItem.Summary[]
  constructor(id: string, summary: ResponseReasoningItem.Summary[]) {
    this.id = id
    this.summary = summary
  }

  async input(): Promise<ResponseInputItem[]> {
    return [{
      type: "reasoning",
      id: this.id,
      summary: this.summary,
    }]
  }
}
