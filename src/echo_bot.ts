import { ChatBot } from "./chat_bot"
import { BotMessage, UserMessage } from "./message"

export class EchoBot extends ChatBot {
  async send_prompt(message: UserMessage) {
    return new BotMessage(message.text)
  }
}
