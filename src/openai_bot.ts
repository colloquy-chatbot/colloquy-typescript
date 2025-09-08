import OpenAI from "openai";

import { ChatBot } from "./chat_bot";
import {
  FunctionCallMessage,
  OpenAIMessageFactory,
  ReasoningMessage,
} from "./openai/message";
import { PromptFunctionRepository, type PromptFunction } from "./function";
import type {
  Response,
  ResponseCreateParams,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses.mjs";
import { tool } from "./openai/function";
import { RoleMessage, type InputMessage } from "./message";

export type Role = "user" | "system" | "assistant";
type RM = RoleMessage<Role, ResponseInputItem>;
type IM = InputMessage<ResponseInputItem>;

export class OpenAIBot extends ChatBot<IM> {
  openai: OpenAI;
  functions: PromptFunctionRepository;
  service_tier?: ResponseCreateParams["service_tier"];
  model: string;
  constructor({
    model = "gpt-4o-mini",
    apiKey,
    service_tier = undefined,
    functions = [],
    ...args
  }: ConstructorParameters<typeof ChatBot<IM>>[0] & {
    apiKey?: string;
    model?: string;
    functions?: PromptFunction<any>[];
    service_tier?: ResponseCreateParams["service_tier"];
  } = {}) {
    super(args);
    this.openai = new OpenAI({ apiKey });
    this.model = model;
    this.functions = new PromptFunctionRepository(functions);
    this.service_tier = service_tier;
  }

  get message_factory() {
    return new OpenAIMessageFactory({ functions: this.functions });
  }

  async send_prompt(): Promise<RM> {
    if (this.debug) console.debug("request", await this.request());
    const response = (await this.openai.responses.create(
      await this.request(),
    )) as Response;
    if (this.debug) console.debug("response", response);

    for (const output of response.output || []) {
      if (output.type === "function_call") {
        await this.call_function(output);
      } else if (output.type === "reasoning") {
        this.history.push(new ReasoningMessage(output.id, output.summary));
      } else if (output.type === "message" && output.status === "completed") {
        this.history.push(new RoleMessage("assistant", response.output_text));
      } else {
        throw new Error(`Unhandled output type ${JSON.stringify(output)}`);
      }
    }

    if (this.needs_reply(response)) {
      return await this.send_prompt();
    } else {
      return this.history.pop() as RM;
    }
  }

  needs_reply(response: Response) {
    return (
      response.status != "completed" ||
      response.output.every((o) => o.type != "message")
    );
  }

  private async call_function(tool_call: ResponseFunctionToolCall) {
    const fn = this.functions.lookup(tool_call.name);

    const call = new FunctionCallMessage(fn, tool_call);
    call.invoke_fn();
    this.history.push(call);
  }

  private async request() {
    const input = [];
    for (const message of this.history) {
      input.push(...(await message.input()));
    }

    const req: ResponseCreateParams = {
      model: this.model,
      input,
      tools: this.functions.array.map((fn) => tool(fn)),
    };

    if (this.instructions) req.instructions = this.instructions;
    if (this.service_tier) req.service_tier = this.service_tier;

    return req;
  }
}
