import type { Message, TextMessage } from "./message";

export abstract class ChatBot<M extends Message, TM extends TextMessage & M> {
  history: M[]
  instructions: string | undefined;

  constructor({ instructions, history }: { instructions?: string, history?: M[] } = {}) {
    this.history = history || []
    this.instructions = instructions
  }

  async prompt(content: string) {
    const message = this.user(content)

    this.history.push(message)
    const response = await this.send_prompt()
    this.history.push(response)

    return response.text
  }

  abstract send_prompt(): Promise<TM>
  abstract user(text: string): M
}
