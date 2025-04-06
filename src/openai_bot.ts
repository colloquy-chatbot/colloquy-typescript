import OpenAI from "openai"

import { ChatBot } from "./chat_bot"
import { BotMessage, FunctionCallMessage, SystemMessage } from "./message"
import type { PromptFunction } from "./function"
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses.mjs"

export class OpenAIBot extends ChatBot {
  openai: OpenAI
  functions: { [name: string]: PromptFunction<any> }
  constructor({ functions = [], ...args }: ConstructorParameters<typeof ChatBot>[0] & { functions?: PromptFunction<any>[] } = {}) {
    super(args)
    this.openai = new OpenAI()
    this.functions = Object.fromEntries(functions.map((f) => [f.name, f]))

    if (this.instructions) this.history.push(new SystemMessage(this.instructions))
  }

  async send_prompt(): Promise<BotMessage> {
    const response = await this.openai.responses.create(this.request())

    for (const tool_call of response.output || []) {
      if (tool_call.type === "function_call") {
        await this.call_function(tool_call)
      } else if (tool_call.status === "completed") {
        return new BotMessage(response.output_text)
      } else {
        throw new Error(`Unhandled output type ${tool_call.type}`)
      }
    }

    return await this.send_prompt()
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
      tools: Object.values(this.functions).map((fn) => fn.tool),
    }
    return req
  }
}
