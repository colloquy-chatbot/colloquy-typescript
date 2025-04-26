import OpenAI from "openai"

import { ChatBot } from "./chat_bot"
import { FunctionCallMessage, ReasoningMessage } from "./openai/message"
import type { PromptFunction } from "./function"
import type { ResponseCreateParams, ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses.mjs"
import { tool } from "./openai/function"
import { RoleMessage, type InputMessage } from "./message"

type Role = "user" | "system" | "assistant"
type RM = RoleMessage<Role, ResponseInputItem>
type IM = InputMessage<ResponseInputItem>

export class OpenAIBot extends ChatBot<IM, RM> {
  openai: OpenAI
  functions: { [name: string]: PromptFunction<any> }
  service_tier?: ResponseCreateParams["service_tier"]
  model: string
  constructor({ model = "gpt-4o-mini", service_tier = undefined, functions = [], ...args }: ConstructorParameters<typeof ChatBot<IM, RM>>[0] & {
    model?: string
    functions?: PromptFunction<any>[]
    service_tier?: ResponseCreateParams["service_tier"]
  } = {}) {
    super(args)
    this.openai = new OpenAI()
    this.model = model
    this.functions = Object.fromEntries(functions.map((f) => [f.name, f]))
    this.service_tier = service_tier

    if (this.instructions) this.history.push(new RoleMessage("system", this.instructions))
  }

  async send_prompt(): Promise<RM> {
    if (this.debug) console.debug("request", this.request())
    const response = await this.openai.responses.create(this.request())
    if (this.debug) console.debug("response", response)

    for (const output of response.output || []) {
      if (output.type === "function_call") {
        await this.call_function(output)
      } else if (output.type === "reasoning") {
        this.history.push(new ReasoningMessage(output.id, output.summary))
      } else if (output.status === "completed") {
        return new RoleMessage("assistant", response.output_text)
      } else {
        throw new Error(`Unhandled output type ${JSON.stringify(output)}`)
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
    const req: ResponseCreateParams = {
      model: this.model,
      input: this.history.map(m => m.input),
      tools: Object.values(this.functions).map((fn) => tool(fn)),
    }

    if (this.service_tier) req.service_tier = this.service_tier

    return req
  }
}
