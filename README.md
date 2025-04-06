# Colloquy

A more intuitive and consistent interface on top of existing chatbot APIs.

## Installation

```bash
# Using npm
npm install colloquy_chatbot

# Using Bun
bun add colloquy_chatbot

# Using yarn
yarn add colloquy_chatbot
```

## Quick Start

```typescript
import { OpenAIBot, PromptFunction } from "colloquy_chatbot";

// Create a basic OpenAI chatbot
const bot = new OpenAIBot({
  instructions: "You are a helpful assistant."
});

// Send a message and get a response
const response = await bot.prompt("Hello, can you help me?");
console.log(response); // OpenAI's response

// Create a chatbot with function calling
function getWeather(location = "New York") {
  return `It's sunny in ${location}`;
}

const weatherBot = new OpenAIBot({
  instructions: "You can check the weather.",
  functions: [
    new PromptFunction(getWeather, {
      description: "Get the current weather for a location"
    })
  ]
});

const weatherResponse = await weatherBot.prompt("What's the weather like in Tokyo?");
console.log(weatherResponse);
```

## Chatbot Types

### OpenAIBot

The main chatbot implementation that uses OpenAI's API:

```typescript
import { OpenAIBot } from "colloquy_chatbot";

const bot = new OpenAIBot({
  instructions: "You are a helpful assistant." // Optional system message
});

const response = await bot.prompt("Hello!");
console.log(response);

// Access conversation history
console.log(bot.history);
```

### EchoBot

A simple bot for testing that echoes back the input:

```typescript
import { EchoBot } from "colloquy_chatbot";

const bot = new EchoBot();
const response = await bot.prompt("Hello!");
console.log(response); // "Hello!"
```

### Custom Bots

Create your own bot by extending the ChatBot class:

```typescript
import { ChatBot, BotMessage } from "colloquy_chatbot";

class ReverseBot extends ChatBot {
  async send_prompt(): Promise<BotMessage> {
    const lastMessage = this.history.at(-1);
    const reversed = lastMessage.text.split("").reverse().join("");
    return new BotMessage(reversed);
  }
}

const bot = new ReverseBot();
console.log(await bot.prompt("Hello")); // "olleH"
```

## Function Calling

Colloquy makes it easy to enable function calling with OpenAI:

```typescript
import { OpenAIBot, PromptFunction } from "colloquy_chatbot";

// Define a function
function calculateArea(length = 1, width = 1) {
  return length * width;
}

// Create a bot with the function
const bot = new OpenAIBot({
  functions: [
    new PromptFunction(calculateArea, {
      description: "Calculate the area of a rectangle",
      parameters: {
        length: { description: "The length of the rectangle" },
        width: { description: "The width of the rectangle" }
      }
    })
  ]
});

// The AI can now use the function when appropriate
const response = await bot.prompt("What's the area of a 5x3 rectangle?");
console.log(response);
```

It can infer a lot from the function definition itself:
* It can determine the name from the name of the function
  - It understands both `() => "foo"` and `function test() { return "foo" }`, but only the latter has a name attached
* Default parameters are used to infer the type when they are specified
  - Typescript annotations are stripped at runtime, but default parameters are always there

These inferences are there to make your life easier, but you can always override everything but parameter names like this:

```typescript
new PromptFunction(calculateArea, {
  name: "some-other-name",
  description: "Calculate the area of a rectangle",
  parameters: {
    length: {
      type: "string",
      description: "The length of the rectangle",
    },
    width: {
      type: "number",
      description: "The width of the rectangle",
    }
  }
})
```

Positional arguments get translated into an object before being sent to OpenAI, so feel free to use them in your functions. The goal is to allow you to define functions in a way that is intuitive, while still translating into a form supported by the API.

### Environment Variables

- `OPENAI_API_KEY`: Required for using OpenAIBot

## License

MIT
