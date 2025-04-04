export abstract class Message {}

export class UserMessage extends Message {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
}

export class BotMessage extends Message {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
}
