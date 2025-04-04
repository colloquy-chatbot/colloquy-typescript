import { Message, BotMessage, UserMessage } from "./message";

export abstract class ChatBot {
  history: Message[]
  instructions: string | undefined;

  constructor({ instructions }: { instructions?: string } = {}) {
    this.history = []
    this.instructions = instructions
  }

  async prompt(content: string) {
    const message = new UserMessage(content)

    this.history.push(message)
    const response = await this.send_prompt(message)
    this.history.push(response)

    return response.text
  }

  abstract send_prompt(message: UserMessage): Promise<BotMessage>
}
