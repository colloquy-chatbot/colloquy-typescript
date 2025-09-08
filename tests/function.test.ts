import { test, expect } from "bun:test";
import { PromptFunction } from "../src/function";

test("converts parameters from object", async () => {
  let input: string = "";
  const fn = new PromptFunction(function test(a = "a") {
    input = a;
  });
  await fn.invoke({ a: "b" });
  expect(input).toEqual("b");
});

test("provides the return value", async () => {
  const fn = new PromptFunction(function test() {
    return "test";
  });
  expect(await fn.invoke({})).toEqual("test");
});

test("provides numeric return values as strings", async () => {
  const fn = new PromptFunction(function test() {
    return 1;
  });
  expect(await fn.invoke({})).toEqual("1");
});

test("provides object return values as strings", async () => {
  const fn = new PromptFunction(function test() {
    return { a: 1 };
  });
  expect(await fn.invoke({})).toEqual('{"a":1}');
});

test("is able to extract parameters of functions with a body containing a comma", async () => {
  let input: boolean = false;
  const fn = new PromptFunction(function test(a = "a") {
    input = ["a", "b"][1] == a;
  });
  await fn.invoke({ a: "b" });
  expect(input).toBeTrue();
});
