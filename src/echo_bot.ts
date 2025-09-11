import { BaseBot } from "./chat_bot.js";
import { type MessageFactory, SimpleMessage } from "./message.js";

class EchoMessageFactory implements MessageFactory<SimpleMessage> {
  user(text: string) {
    return new SimpleMessage(text);
  }

  deserialize(text: any) {
    return this.user(text);
  }
}

export class EchoBot extends BaseBot<SimpleMessage> {
  get message_factory() {
    return new EchoMessageFactory();
  }

  async send_prompt() {
    const message = this.history.at(-1);
    return new SimpleMessage(message!.text);
  }
}
