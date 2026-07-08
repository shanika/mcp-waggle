export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function toolHandler<TInput>(fn: (input: TInput) => unknown): (input: TInput) => ToolResult {
  return (input: TInput) => {
    try {
      return jsonResult(fn(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  };
}
