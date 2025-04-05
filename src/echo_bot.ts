import { ChatBot } from "./chat_bot"
import { BotMessage, UserMessage } from "./message"

export class EchoBot extends ChatBot {
  async send_prompt() {
    const message = this.history.at(-1) as UserMessage
    return new BotMessage(message.text)
  }
}
