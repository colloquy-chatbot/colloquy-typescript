import type { PromptFunction } from "./function";

export interface MessageFactory<M> {
  user(text: string): M;
  deserialize(serialized: any): M;
}

export interface Message {}

export interface TextMessage extends Message {
  text: string;
}

export interface InputMessage<T> {
  input(): Promise<T[]>;
}

export class SimpleMessage implements TextMessage {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

export class RoleMessage<Role, Input>
  extends SimpleMessage
  implements InputMessage<Input>
{
  role: Role;
  constructor(role: Role, text: string) {
    super(text);
    this.role = role;
  }

  async input(): Promise<Input[]> {
    return [{ role: this.role, content: this.text }] as Input[];
  }
}

export abstract class FunctionCallMessage<ReturnValue> {
  fn: PromptFunction<ReturnValue>;
  result?: string;
  constructor(fn: PromptFunction<ReturnValue>, result?: string) {
    this.fn = fn;
    this.result = result;
  }

  async invoke_fn(): Promise<string> {
    this.result ||= await this.fn.invoke(this.arguments);
    return this.result;
  }

  abstract get arguments(): Record<string, any>;
}

export class FunctionResultMessage {
  id: string;
  result: string;
  constructor(id: string, result: string) {
    this.id = id;
    this.result = result;
  }
}
