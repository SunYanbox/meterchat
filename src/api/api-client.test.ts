import { buildRequestBody, parseSSEChunk, extractUsage } from './api-client';

describe('ApiClient', () => {
  test('buildRequestBody creates proper OpenAI format', () => {
    const body = buildRequestBody(
      'You are helpful.',
      [{ role: 'user', content: 'Hi' }],
      'deepseek-chat',
      0.7
    );
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('You are helpful.');
    expect(body.messages[1].role).toBe('user');
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(true);
  });

  test('parseSSEChunk parses a data line with content', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    const result = parseSSEChunk(line);
    expect(result).toEqual({ content: 'Hello', usage: undefined, done: false });
  });

  test('parseSSEChunk parses [DONE]', () => {
    const result = parseSSEChunk('data: [DONE]');
    expect(result.done).toBe(true);
  });

  test('parseSSEChunk parses usage data', () => {
    const line = 'data: {"usage":{"prompt_tokens":10,"completion_tokens":20,"prompt_cache_hit_tokens":5,"prompt_cache_miss_tokens":5}}';
    const result = parseSSEChunk(line);
    expect(result.usage).toBeDefined();
    expect(result.usage!.prompt_tokens).toBe(10);
  });

  test('extractUsage returns usage from chunk', () => {
    const chunk = { usage: { prompt_tokens: 10, completion_tokens: 20, prompt_cache_hit_tokens: 5, prompt_cache_miss_tokens: 5 } };
    const usage = extractUsage(chunk);
    expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, prompt_cache_hit_tokens: 5, prompt_cache_miss_tokens: 5 });
  });

  test('extractUsage returns undefined when no usage', () => {
    expect(extractUsage({})).toBeUndefined();
  });

  test('parseSSEChunk skips non-data lines', () => {
    expect(parseSSEChunk(': heartbeat')).toEqual({ content: '', usage: undefined, done: false });
  });

  test('parseSSEChunk handles invalid JSON gracefully', () => {
    expect(parseSSEChunk('data: {invalid json}')).toEqual({ content: '', usage: undefined, done: false });
  });
});
