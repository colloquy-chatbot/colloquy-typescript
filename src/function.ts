import type { FunctionTool } from "openai/resources/responses/responses.mjs"
import { parseScript, type Program } from "esprima"
import type { BaseNode, FunctionDeclaration, Pattern, ExpressionStatement, ArrowFunctionExpression, Identifier } from "estree"
import { generate } from "escodegen"

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

  get tool(): FunctionTool & { parameters: {
    properties: Record<string, unknown>,
    additionalProperties: boolean,
    required: string[],
  } } {
    const tool: FunctionTool & { parameters: {
    properties: Record<string, unknown>,
    additionalProperties: boolean,
    required: string[],
  } } = {
      type: "function",
      name: this.name,
      parameters: {
        properties: Object.fromEntries(parameters_for(this.fn, this.parameters)),
        additionalProperties: false,
        required: Object.keys(this.parameters),
      },
      strict: true,
    }
    if (this.description) tool.description = this.description

    return tool
  }
}

export function parameters_for(fn: (...args: any[]) => any, overlay: ParametersOverlay = {}) {
  const ast = parseScript(fn.toString())

  let fn_ast = (
    find_node(ast, "FunctionDeclaration") || find_node(ast, "ArrowFunctionExpression")
  ) as FunctionDeclaration | ArrowFunctionExpression | undefined

  return extract_params(fn_ast?.params || []).map(
    (param) => augment_param(param, overlay),
  )
}

function find_node(ast: BaseNode, type: string): BaseNode | undefined {
  if (ast.type == type) return ast

  if (ast.type == "Program") {
    const program = ast as Program
    for (const node of program.body) {
      const search = find_node(node, type)
      if (search) return search
    }
  }

  if (ast.type == "ExpressionStatement") {
    const expression = ast as ExpressionStatement
    return find_node(expression.expression, type)
  }

  return undefined
}

function extract_params(ast: Pattern[]) {
  const params: {
    name: string
    def?: BaseNode
  }[] = []

  for (const prm of ast) {
    let name: string
    let def: BaseNode | undefined
    if (prm.type == "Identifier") {
      name = prm.name
    } else if (prm.type == "AssignmentPattern") {
      name = (prm.left as Identifier).name
      def = prm.right
    } else {
      throw new Error(`Unexpected node type: ${prm.type}`)
    }

    params.push({
      name,
      def,
    })
  }

  return params
}

function augment_param({ name, def }: { name: string, def?: BaseNode }, overlay: ParametersOverlay): [string, Parameter] {
  return [name, parameter_for(def, overlay[name])]
}

function parameter_for(def: BaseNode | undefined, overlay: ParameterOverlay) {
  let type = "any"
  let properties;

  if (def) {
    let result;

    const generated = generate(def)
    try {
      result = eval(`(${generated})`)
    } catch(e) {
      throw new Error(`Problem evaluating \`(${generated})\`: ${e}`)
    }

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
