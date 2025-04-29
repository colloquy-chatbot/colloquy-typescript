import type { ResponseFunctionToolCall, ResponseInputItem, ResponseReasoningItem } from "openai/resources/responses/responses.mjs"
import { PromptFunction, PromptFunctionRepository } from "../function"
import * as base from "../message"

type Role = "user" | "system" | "assistant"
type IM = base.InputMessage<ResponseInputItem>

export class OpenAIMessageFactory implements base.MessageFactory<IM> {
  functions: PromptFunctionRepository
  constructor({ functions }: { functions: PromptFunctionRepository }) {
    this.functions = functions
  }

  user(text: string): base.RoleMessage<Role, ResponseInputItem> {
    return new base.RoleMessage("user", text)
  }

  deserialize(serialized: any): IM {
    const json = JSON.parse(serialized)

    if (json["role"])
      return new base.RoleMessage(json["role"], json["text"])
    else if (json["fn"])
      return new FunctionCallMessage(
        this.functions.lookup(json["fn"]["name"]),
        json["tool_call"],
      )
    else
      throw new Error(`Unexpected message: ${serialized}`)
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
