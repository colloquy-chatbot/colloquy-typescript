import { ChatBot } from "./chat_bot";
import { Anthropic } from "@anthropic-ai/sdk"
import { FunctionCallMessage } from "./claude/message";
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/index.mjs";
import { type PromptFunction } from "./function";
import { RoleMessage, type InputMessage } from "./message";

type Role = "user" | "assistant"

type RM = RoleMessage<Role, MessageParam>
type IM = InputMessage<MessageParam>

export class ClaudeBot extends ChatBot<IM, RM> {
  client: Anthropic;
  functions: { [k: string]: PromptFunction<any>; };
  constructor({ functions = [], ...args }: ConstructorParameters<typeof ChatBot<IM, RM>>[0] & { functions?: PromptFunction<any>[] } = {}) {
    super(args)
    this.client = new Anthropic()
    this.functions = Object.fromEntries(functions.map((f) => [f.name, f]))
  }

  async send_prompt(): Promise<RM> {
    if (this.debug) console.debug("request", this.request())
    const response = await this.client.messages.create(this.request())
    if (this.debug) console.debug("response", response)

    let needs_reply = false
    for (const content of response.content) {
      if (content.type === "tool_use") {
        await this.call_function(content)
        needs_reply = true
      } else if (content.type === "text") {
        this.history.push(new RoleMessage("assistant", content.text))
      } else {
        throw new Error(`Unhandled output type ${content.type}`)
      }
    }

    if (needs_reply) {
      return await this.send_prompt()
    } else {
      return this.history.pop() as RM
    }
  }

    private request(): Anthropic.Messages.MessageCreateParamsNonStreaming {
        return {
            model: "claude-3-7-sonnet-20250219",
            tools: Object.values(this.functions).map((fn) => ({
                name: fn.name,
                description: fn.description,
                input_schema: fn.object_spec as Tool.InputSchema,
            })),
            max_tokens: 1000,
            temperature: 1,
            system: this.instructions,
            messages: [
                ...this.history.map((message) => message.input),
            ]
        };
    }

  private async call_function(content: ToolUseBlock) {
    const fn = this.functions[content.name]

    const call = new FunctionCallMessage(fn, content)
    this.history.push(call)
    this.history.push(await call.invoke())
  }

  user(text: string): RM {
    return new RoleMessage("user", text)
  }
}
