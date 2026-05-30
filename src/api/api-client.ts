export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  stream: boolean;
}

export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
}

export interface SSEChunk {
  content: string;
  usage: UsageData | undefined;
  done: boolean;
}

export function buildRequestBody(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model: string,
  temperature: number
): RequestBody {
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role as ChatMessage['role'], content: m.content })),
  ];

  return {
    model,
    messages: fullMessages,
    temperature,
    stream: true,
  };
}

export function parseSSEChunk(line: string): SSEChunk {
  if (!line.startsWith('data: ')) {
    return { content: '', usage: undefined, done: false };
  }

  const data = line.slice(6).trim();

  if (data === '[DONE]') {
    return { content: '', usage: undefined, done: true };
  }

  try {
    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content || '';
    const usage: UsageData | undefined = parsed.usage ? extractUsage(parsed) : undefined;
    return { content, usage, done: false };
  } catch {
    return { content: '', usage: undefined, done: false };
  }
}

export function extractUsage(chunk: Record<string, any>): UsageData | undefined {
  if (!chunk.usage) return undefined;
  return {
    prompt_tokens: chunk.usage.prompt_tokens || 0,
    completion_tokens: chunk.usage.completion_tokens || 0,
    prompt_cache_hit_tokens: chunk.usage.prompt_cache_hit_tokens || 0,
    prompt_cache_miss_tokens: chunk.usage.prompt_cache_miss_tokens || 0,
  };
}

export async function* streamChat(
  baseUrl: string,
  apiKey: string,
  body: RequestBody
): AsyncGenerator<SSEChunk> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new ApiError(response.status, errorText);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        const chunk = parseSSEChunk(line);
        yield chunk;
        if (chunk.done) return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`API Error (${statusCode})`);
    this.name = 'ApiError';
  }
}
