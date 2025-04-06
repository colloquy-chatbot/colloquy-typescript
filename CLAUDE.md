# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands
- Install dependencies: `bun install`
- Run the project: `bun run index.ts`
- Run all tests: `bun test`
- Run a single test: `bun test tests/file.test.ts`
- Run tests matching pattern: `bun test --test-name-pattern "pattern"`
- Show test coverage: `bun test --coverage`

## Code Style Guidelines
- **Types**: Use TypeScript with strict mode enabled
- **Imports**: Use ES modules (`import` syntax)
- **Error Handling**: Create custom error classes that extend Error
- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **File Structure**: Group related functionality in dedicated files
- **Default Values**: Set default values in function parameters when possible
- **Testing**: Use Bun's built-in test runner with `expect` assertions
- **Format**: Keep code clean and consistent with clear naming