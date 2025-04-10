import { ChatBot } from "./chat_bot"
import { SimpleMessage } from "./message"

export class EchoBot extends ChatBot<SimpleMessage, SimpleMessage> {
  async send_prompt() {
    const message = this.history.at(-1)
    return new SimpleMessage(message!.text)
  }

  user(text: string) {
    return new SimpleMessage(text)
  }
}
