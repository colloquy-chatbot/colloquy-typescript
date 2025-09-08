import { mock, type Mock } from "bun:test";

export function mock_multiple_return_values<T>(values: T[]): Mock<any> {
  return mock(async () => {
    if (values.length == 0) throw new Error("expected a mocked value");
    return values.shift() as T;
  });
}

export function mock_requests(m: Mock<any>) {
  return m.mock.calls.map((c: any[]) => c[0]);
}
