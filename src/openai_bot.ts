import OpenAI from "openai"

import { ChatBot } from "./chat_bot"
import { FunctionCallMessage } from "./openai/message"
import type { PromptFunction } from "./function"
import type { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses.mjs"
import { tool } from "./openai/function"
import { RoleMessage, type InputMessage } from "./message"

type Role = "user" | "system" | "assistant"
type RM = RoleMessage<Role, ResponseInputItem>
type IM = InputMessage<ResponseInputItem>

export class OpenAIBot extends ChatBot<IM, RM> {
  openai: OpenAI
  functions: { [name: string]: PromptFunction<any> }
  constructor({ functions = [], ...args }: ConstructorParameters<typeof ChatBot>[0] & { functions?: PromptFunction<any>[] } = {}) {
    super(args)
    this.openai = new OpenAI()
    this.functions = Object.fromEntries(functions.map((f) => [f.name, f]))

    if (this.instructions) this.history.push(new RoleMessage("system", this.instructions))
  }

  async send_prompt(): Promise<RM> {
    const response = await this.openai.responses.create(this.request())

    for (const tool_call of response.output || []) {
      if (tool_call.type === "function_call") {
        await this.call_function(tool_call)
      } else if (tool_call.status === "completed") {
        return new RoleMessage("assistant", response.output_text)
      } else {
        throw new Error(`Unhandled output type ${tool_call.type}`)
      }
    }

    return await this.send_prompt()
  }

  user(text: string): RM {
    return new RoleMessage("user", text)
  }

  private async call_function(tool_call: ResponseFunctionToolCall) {
    const fn = this.functions[tool_call.name]

    const call = new FunctionCallMessage(fn, tool_call)
    this.history.push(call)
    this.history.push(await call.invoke())
  }

  private request() {
    const req = {
      model: "gpt-4o-mini",
      input: this.history.map(m => m.input),
      tools: Object.values(this.functions).map((fn) => tool(fn)),
    }
    return req
  }
}
