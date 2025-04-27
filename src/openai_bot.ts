import OpenAI from "openai"

import { ChatBot } from "./chat_bot"
import { FunctionCallMessage, OpenAIMessageFactory, ReasoningMessage } from "./openai/message"
import type { PromptFunction } from "./function"
import type { Response, ResponseCreateParams, ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses.mjs"
import { tool } from "./openai/function"
import { RoleMessage, type InputMessage } from "./message"

type Role = "user" | "system" | "assistant"
type RM = RoleMessage<Role, ResponseInputItem>
type IM = InputMessage<ResponseInputItem>

export class OpenAIBot extends ChatBot<IM> {
  openai: OpenAI
  functions: { [name: string]: PromptFunction<any> }
  service_tier?: ResponseCreateParams["service_tier"]
  model: string
  constructor({ model = "gpt-4o-mini", service_tier = undefined, functions = [], ...args }: ConstructorParameters<typeof ChatBot<IM>>[0] & {
    model?: string
    functions?: PromptFunction<any>[]
    service_tier?: ResponseCreateParams["service_tier"]
  } = {}) {
    super(args)
    this.openai = new OpenAI()
    this.model = model
    this.functions = Object.fromEntries(functions.map((f) => [f.name, f]))
    this.service_tier = service_tier
  }

  get message_factory() {
    return new OpenAIMessageFactory()
  }

  async send_prompt(): Promise<RM> {
    if (this.debug) console.debug("request", await this.request())
    const response = await this.openai.responses.create(await this.request()) as Response
    if (this.debug) console.debug("response", response)

    for (const output of response.output || []) {
      if (output.type === "function_call") {
        await this.call_function(output)
      } else if (output.type === "reasoning") {
        this.history.push(new ReasoningMessage(output.id, output.summary))
      } else if (output.status === "completed") {
        this.history.push(new RoleMessage("assistant", response.output_text))
      } else {
        throw new Error(`Unhandled output type ${JSON.stringify(output)}`)
      }
    }

    if (response.status != "completed") {
      return await this.send_prompt()
    } else {
      return this.history.pop() as RM
    }
  }

  private async call_function(tool_call: ResponseFunctionToolCall) {
    const fn = this.functions[tool_call.name]

    const call = new FunctionCallMessage(fn, tool_call)
    call.invoke_fn()
    this.history.push(call)
  }

  private async request() {
    const input = []
    for (const message of this.history) {
      input.push(...await message.input())
    }

    const req: ResponseCreateParams = {
      model: this.model,
      input,
      tools: Object.values(this.functions).map((fn) => tool(fn)),
    }

    if (this.instructions) req.instructions = this.instructions
    if (this.service_tier) req.service_tier = this.service_tier

    return req
  }
}
