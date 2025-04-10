import type { PromptFunction } from "./function"

export interface Message {}
export interface TextMessage extends Message {
  text: string
}

export interface InputMessage<T> {
  input: T
}

export class SimpleMessage implements TextMessage {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

export class RoleMessage<Role, Input> extends SimpleMessage implements InputMessage<Input> {
  role: Role
  constructor(role: Role, text: string) {
    super(text)
    this.role = role
  }

  get input(): Input {
    return { role: this.role, content: this.text } as Input
  }
}

export abstract class FunctionCallMessage<ReturnValue> {
  fn: PromptFunction<ReturnValue>
  constructor(fn: PromptFunction<ReturnValue>) {
    this.fn = fn
  }

  async invoke_fn(): Promise<string> {
    return this.fn.invoke(this.arguments)
  }

  abstract get arguments(): Record<string, any>
}

export class FunctionResultMessage {
  id: string
  result: string
  constructor(id: string, result: string) {
    this.id = id
    this.result = result
  }
}
