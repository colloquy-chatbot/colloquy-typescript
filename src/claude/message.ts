import type {
  MessageParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/index.mjs";
import * as base from "../message.js";
import type { PromptFunction } from "../function.js";

type Role = "user" | "assistant";

export type RM = base.RoleMessage<Role, MessageParam>;
export type IM = base.InputMessage<MessageParam>;

export class ClaudeMessageFactory implements base.MessageFactory<IM> {
  user(text: string): RM {
    return new base.RoleMessage("user", text);
  }

  deserialize(content: any): RM {
    if (content.type === "text") {
      return new base.RoleMessage("assistant", content.text);
    } else {
      throw new Error(`Unhandled output type ${content.type}`);
    }
  }
}

export class FunctionCallMessage<T>
  extends base.FunctionCallMessage<T>
  implements base.InputMessage<MessageParam>
{
  content: ToolUseBlock;
  constructor(fn: PromptFunction<T>, content: ToolUseBlock, result?: string) {
    super(fn, result);
    this.content = content;
  }

  async input(): Promise<MessageParam[]> {
    return [
      {
        content: [this.content],
        role: "assistant",
      },
      {
        content: [
          {
            type: "tool_result",
            tool_use_id: this.content.id,
            content: await this.invoke_fn(),
          },
        ],
        role: "user",
      },
    ];
  }

  get arguments(): Record<string, any> {
    return this.content.input as Record<string, any>;
  }
}
