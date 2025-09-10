import type { Message, MessageFactory, TextMessage } from "./message.js";

export abstract class ChatBot<M extends Message> {
  history: M[];
  instructions: string | undefined;
  debug: boolean;

  constructor({
    instructions,
    history = [],
    debug = false,
  }: { instructions?: string; history?: M[]; debug?: boolean } = {}) {
    this.history = history;
    this.instructions = instructions;
    this.debug = debug;
  }

  abstract get message_factory(): MessageFactory<M>;

  async prompt(content: string) {
    const message = this.message_factory.user(content);

    this.history.push(message);
    const response = await this.send_prompt();
    this.history.push(response);

    return response.text;
  }

  abstract send_prompt(): Promise<TextMessage & M>;
}
