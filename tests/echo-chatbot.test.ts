import { test, expect } from "bun:test"
import { EchoBot, UserMessage, BotMessage } from "../src/colloquy"

test("create a simple echo chatbot", async () => {
  const bot = new EchoBot()
  expect(await bot.prompt("hello")).toEqual("hello")
})

test("includes history of previous prompts", async () => {
  const bot = new EchoBot()
  await bot.prompt("hello")
  expect(bot.history).toEqual([new UserMessage("hello"), new BotMessage("hello")])
})

test("add instructions in constructor", () => {
  const instructions = "instructions are irrelevant for echoing"
  const bot = new EchoBot({ instructions })
  expect(bot.instructions).toEqual(instructions)
})
