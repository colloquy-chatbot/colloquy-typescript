import type { FunctionTool } from "openai/resources/responses/responses.mjs"

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

export class PromptFunction<Return> {
  fn: (...args: any[]) => Return
  name: string
  private description: string | undefined
  private parameters: ParametersOverlay
  constructor(
    fn: (...args: any[]) => Return,
    { name, description, parameters = {} }: {
      name?: string
      description?: string
      parameters?: ParametersOverlay
    } = {}
  ) {
    if (!name && fn.name == "") throw new UnnamedFunctionError()

    this.fn = fn
    this.name = name || fn.name
    this.description = description
    this.parameters = parameters
  }

  async invoke(params: { [name: string]: any }): Promise<string> {
    const result = await this.fn(...parameters_for(this.fn, this.parameters).map(
      ([name, _param]) => params[name],
    ))

    if (typeof result === "string") return result

    return JSON.stringify(result)
  }

  get tool(): FunctionTool {
    const tool: FunctionTool = {
      type: "function",
      name: this.name,
      parameters: Object.fromEntries(parameters_for(this.fn, this.parameters)),
      strict: true,
    }
    if (this.description) tool.description = this.description

    return tool
  }
}

export function parameters_for(fn: (...args: any[]) => any, overlay: ParametersOverlay = {}) {
  let param_string = fn.toString().replace(/^[^(]*\((.*)\)[^)]*$/s, "$1")
  if (!param_string) return []

  param_string = param_string.replace(/\s/g, "")
  return extract_params(param_string).map(
    (param) => augment_param(param, overlay),
  )
}

function extract_params(params_string: string) {
  const params: {
    name: string
    def: string
  }[] = []
  let level = 0
  for (const param_string of params_string.split(/,\s*/)) {
    if (level > 0) {
      const param = params[params.length - 1]
      param.def += `,${param_string}`
    } else {
      const [name, def] = param_string.split("=")
      params.push({ name, def })
    }

    level += [...param_string].reduce(
      (count, char) => char == "{"
        ? count + 1
        : char == "}"
        ? count - 1
        : count,
      0,
    )
  }
  return params
}

function augment_param({ name, def }: { name: string, def: string }, overlay: ParametersOverlay): [string, Parameter] {
  return [name, parameter_for(def, overlay[name])]
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
