import OpenAI from "openai"

import { ChatBot } from "./chat_bot"
import { Message, BotMessage, UserMessage } from "./message"
import type { FunctionTool, ResponseCreateParams, ResponseInput, ResponseInputItem } from "openai/resources/responses/responses.mjs"

export class OpenAIBot extends ChatBot {
  openai: OpenAI
  functions: OpenAIFunction[]
  constructor({ functions = [], ...args }: ConstructorParameters<typeof ChatBot>[0] & { functions?: OpenAIFunction[] } = {}) {
    super(args)
    this.openai = new OpenAI()
    this.functions = functions
  }

  // Message included with the rest of the history
  async send_prompt(_message: UserMessage) {
    const args: ResponseCreateParams = {
      model: "gpt-4o-mini",
      input: this.input(),
    }

    if (this.functions.length > 0)
      args.tools = this.functions.map((fn) => fn.tool)

    const response = await this.openai.responses.create(args)

    return new BotMessage(response.output_text)
  }

  private input() {
    const input: ResponseInput = []

    if (this.instructions) input.push(this.system())

    for (const message of this.history) {
      input.push(this.input_for(message))
    }

    return input
  }

  private input_for(message: Message) {
    if (message instanceof BotMessage)
      return this.assistant(message)
    else if (message instanceof UserMessage)
      return this.user(message)
    throw new Error("Unexpected message class")
  }

  private system() {
    return this.input_item("system", this.instructions as string)
  }

  private user(message: UserMessage) {
    return this.input_item("user", message.text)
  }

  private assistant(message: BotMessage) {
    return this.input_item("assistant", message.text)
  }

  private input_item(role: "user" | "system" | "assistant", content: string): ResponseInputItem {
    return { role, content }
  }
}

export class UnnamedFunctionError extends Error {}

export type Parameter = {
  type: string
  description?: string
  properties?: Parameters }
type Parameters = { [name: string]: Parameter }

type ParameterOverlay = {
  type?: string
  description?: string
  properties?: ParametersOverlay
}
type ParametersOverlay = { [name: string]: ParameterOverlay }

export class OpenAIFunction {
  private fn: (...args: any) => any
  private name: string
  private description: string | undefined
  private parameters: ParametersOverlay
  constructor(fn: (args: any) => any, { name, description, parameters = {} }: {
    name?: string
    description?: string
    parameters?: ParametersOverlay
  } = {}) {
    if (!name && fn.name == "") throw new UnnamedFunctionError()

    this.fn = fn
    this.name = name || fn.name
    this.description = description
    this.parameters = parameters
  }

  get tool(): FunctionTool {
    const tool: FunctionTool = {
      type: "function",
      name: this.name,
      parameters: this.build_parameters(),
      strict: true,
    }
    if (this.description) tool.description = this.description

    return tool
  }

  private build_parameters(): Parameters {
    const parameters: Parameters = {}

    for (const [name, value] of Object.entries(parameter_names(this.fn, this.parameters))) {
      parameters[name] = value
    }

    return parameters
  }
}

export function parameter_names(fn: (...args: any[]) => any, overlay: ParametersOverlay = {}) {
  const params: Parameters = {}
  let paramString = fn.toString().replace(/^[^(]*\((.*)\)[^)]*$/s, "$1")
  if (paramString) {
    paramString = paramString.replace(/\s/g, "")
    for (const param of paramString.split(/,\s*/)) {
      augment_param(params, param, overlay)
    }
  }
  return params
}

function augment_param(params: Parameters, param: string, overlay: ParametersOverlay) {
  const [name, def] = param.split(/=/)
  params[name] = parameter_for(def, overlay[name])
}

function parameter_for(def: string, overlay: ParameterOverlay) {
  let type = "any"
  let properties;

  if (def) {
    const result = eval(`(${def})`)
    type = typeof result

    if (!result) {
      type = "null"
    } else if (result && typeof result == "object") {
      return {
        type,
        ...overlay,
        properties: object_properties(result, overlay),
      }
    }
  }

  return { type, properties, ...overlay } as Parameter
}

function object_properties(value: { [name: string]: any }, overlay: ParameterOverlay): Parameters {
  return Object.fromEntries(
    Object.entries(value).map(([name, value]) => {
      const sub_overlay = (overlay?.properties && overlay.properties[name]) || {}
      let parameter: Parameter = {
        type: typeof value,
      }

      if (value && typeof value === "object") {
        parameter.properties = object_properties(value, sub_overlay)
      } else {
        parameter = { ...parameter, ...sub_overlay } as Parameter
      }

      return [
        name,
        parameter,
      ]
    })
  )
}
