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
  private responses: (string | Error)[] = [];
  private responseIndex: number = 0;
  private defaultResponse: string | Error = "Mock response";

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
    responses?: (string | Error)[];
    defaultResponse?: string | Error;
  } = {}) {
    super({ instructions, history, debug });
    this.responses = responses;
    this.defaultResponse = defaultResponse;
  }

  get message_factory() {
    return new MockMessageFactory();
  }

  async send_prompt() {
    let response: string | Error;

    if (this.responseIndex < this.responses.length) {
      response = this.responses[this.responseIndex];
      this.responseIndex++;
    } else {
      response = this.defaultResponse;
    }

    if (response instanceof Error) {
      throw response;
    }

    return new SimpleMessage(response);
  }

  addResponse(response: string | Error) {
    this.responses.push(response);
  }

  addResponses(responses: (string | Error)[]) {
    this.responses.push(...responses);
  }

  addError(error: Error) {
    this.responses.push(error);
  }

  addErrors(errors: Error[]) {
    this.responses.push(...errors);
  }

  setDefaultResponse(response: string | Error) {
    this.defaultResponse = response;
  }

  setDefaultError(error: Error) {
    this.defaultResponse = error;
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
