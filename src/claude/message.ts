import type { MessageParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/index.mjs"
import * as base from "../message"
import type { PromptFunction } from "../function"

export class FunctionCallMessage<T> extends base.FunctionCallMessage<T> implements base.InputMessage<MessageParam> {
  content: ToolUseBlock
  constructor(fn: PromptFunction<T>, content: ToolUseBlock) {
    super(fn)
    this.content = content
  }

  get input(): MessageParam {
    return {
      content: [this.content],
      role: "assistant",
    }
  }

  async invoke(): Promise<FunctionResultMessage> {
    return new FunctionResultMessage(
      this.content.id,
      await this.invoke_fn()
    )
  }

  get arguments(): Record<string, any> {
    return this.content.input as Record<string, any>
  }
}

export class FunctionResultMessage extends base.FunctionResultMessage implements base.InputMessage<MessageParam> {
  get input(): MessageParam {
    return {
      content: [{
        type: "tool_result",
        tool_use_id: this.id,
        content: this.result,
      }],
      role: "user",
    }
  }
}
