import { BaseBot } from "./chat_bot.js";
import { type MessageFactory, SimpleMessage } from "./message.js";

class MockMessageFactory implements MessageFactory<SimpleMessage> {
  user(text: string) {
    return new SimpleMessage(text);
  }

  deserialize(text: any) {
    return this.user(text);
  }
}

export class MockBot extends BaseBot<SimpleMessage> {
  private responses: string[] = [];
  private responseIndex: number = 0;
  private defaultResponse: string = "Mock response";

  constructor({
    instructions,
    history = [],
    debug = false,
    responses = [],
    defaultResponse = "Mock response",
  }: {
    instructions?: string;
    history?: SimpleMessage[];
    debug?: boolean;
    responses?: string[];
    defaultResponse?: string;
  } = {}) {
    super({ instructions, history, debug });
    this.responses = responses;
    this.defaultResponse = defaultResponse;
  }

  get message_factory() {
    return new MockMessageFactory();
  }

  async send_prompt() {
    let responseText: string;

    if (this.responseIndex < this.responses.length) {
      responseText = this.responses[this.responseIndex];
      this.responseIndex++;
    } else {
      responseText = this.defaultResponse;
    }

    return new SimpleMessage(responseText);
  }

  addResponse(response: string) {
    this.responses.push(response);
  }

  addResponses(responses: string[]) {
    this.responses.push(...responses);
  }

  setDefaultResponse(response: string) {
    this.defaultResponse = response;
  }

  reset() {
    this.responseIndex = 0;
    this.history = [];
  }

  resetResponses() {
    this.responses = [];
    this.responseIndex = 0;
  }
}
