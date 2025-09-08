import { type PromptFunction } from "../function";
import type { FunctionTool } from "openai/resources/responses/responses.mjs";

type StrictFunctionTool = FunctionTool & {
  parameters: {
    properties: Record<string, unknown>;
    additionalProperties: boolean;
    required: string[];
  };
};

export function tool<T>(fn: PromptFunction<T>): StrictFunctionTool {
  const tool: StrictFunctionTool = {
    type: "function",
    name: fn.name,
    parameters: {
      ...fn.object_spec,
      additionalProperties: false,
    },
    strict: true,
  };
  if (fn.description) tool.description = fn.description;

  return tool;
}
