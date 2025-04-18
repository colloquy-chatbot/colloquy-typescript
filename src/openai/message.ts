import type { ResponseFunctionToolCall, ResponseInputItem, ResponseReasoningItem } from "openai/resources/responses/responses.mjs"
import type { PromptFunction } from "../function"
import * as base from "../message"

export class FunctionCallMessage<ReturnValue> extends base.FunctionCallMessage<ReturnValue> implements base.InputMessage<ResponseInputItem> {
  tool_call: ResponseFunctionToolCall
  constructor(fn: PromptFunction<ReturnValue>, tool_call: ResponseFunctionToolCall) {
    super(fn)
    this.tool_call = tool_call
  }

  async invoke() {
    return new FunctionResultMessage(
      this.tool_call.call_id,
      await this.invoke_fn()
    )
  }

  get arguments() {
    return JSON.parse(this.tool_call.arguments)
  }

  get input(): ResponseInputItem {
    return this.tool_call
  }
}

export class FunctionResultMessage extends base.FunctionResultMessage implements base.InputMessage<ResponseInputItem> {
  get input(): ResponseInputItem {
    return {
      type: "function_call_output",
      call_id: this.id,
      output: this.result,
    }
  }
}

export class ReasoningMessage implements base.InputMessage<ResponseInputItem> {
  id: string
  summary: ResponseReasoningItem.Summary[]
  constructor(id: string, summary: ResponseReasoningItem.Summary[]) {
    this.id = id
    this.summary = summary
  }

  get input(): ResponseInputItem {
    return {
      type: "reasoning",
      id: this.id,
      summary: this.summary,
    }
  }
}
