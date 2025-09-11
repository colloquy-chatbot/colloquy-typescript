import { BaseBot } from "./chat_bot.js";
import { Anthropic } from "@anthropic-ai/sdk";
import {
  ClaudeMessageFactory,
  FunctionCallMessage,
  type IM,
  type RM,
} from "./claude/message.js";
import type { Tool } from "@anthropic-ai/sdk/resources/index.mjs";
import { PromptFunctionRepository, type IPromptFunction } from "./function.js";
import { RoleMessage } from "./message.js";

export class ClaudeBot extends BaseBot<IM> {
  client: Anthropic;
  functions: PromptFunctionRepository;
  constructor({
    functions = [],
    apiKey,
    ...args
  }: ConstructorParameters<typeof BaseBot<IM>>[0] & {
    apiKey?: string;
    functions?: IPromptFunction<any>[];
  } = {}) {
    super(args);
    this.client = new Anthropic({ apiKey });
    this.functions = new PromptFunctionRepository(functions);
  }

  get message_factory() {
    return new ClaudeMessageFactory();
  }

  async send_prompt(): Promise<RM> {
    if (this.debug) console.debug("request", await this.request());
    const response = await this.client.messages.create(await this.request());
    if (this.debug) console.debug("response", response);

    for (const content of response.content) {
      this.history.push(...(await this.convert_to_message(content)));
    }

    if (this.needs_reply(response)) {
      return await this.send_prompt();
    } else {
      return this.history.pop() as RM;
    }
  }

  needs_reply(
    response: Anthropic.Messages.Message & {
      _request_id?: string | null | undefined;
    },
  ) {
    return response.stop_reason != "end_turn";
  }

  private async convert_to_message(
    content: Anthropic.Messages.ContentBlock,
  ): Promise<IM[]> {
    if (content.type === "tool_use") {
      const fn = this.functions.lookup(content.name);

      const call = new FunctionCallMessage(fn, content);
      return [call];
    } else if (content.type === "text") {
      return [new RoleMessage("assistant", content.text)];
    } else {
      throw new Error(`Unhandled output type ${content.type}`);
    }
  }

  private async request(): Promise<Anthropic.Messages.MessageCreateParamsNonStreaming> {
    const messages = [];
    for (const message of this.history) {
      messages.push(...(await message.input()));
    }

    return {
      model: "claude-3-7-sonnet-20250219",
      tools: this.functions.array.map((fn) => ({
        name: fn.name,
        description: fn.description,
        input_schema: fn.object_spec as Tool.InputSchema,
      })),
      max_tokens: 1000,
      temperature: 1,
      system: this.instructions,
      messages,
    };
  }
}
