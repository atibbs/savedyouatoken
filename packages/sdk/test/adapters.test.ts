import { describe, expect, it } from 'vitest';
import { anthropicAdapter } from '../src/adapters/anthropic';
import { openaiAdapter } from '../src/adapters/openai';

describe('anthropic adapter', () => {
  it('extracts model, string system, tools and usage', () => {
    const captured = anthropicAdapter.extract(
      {
        model: 'claude-sonnet-5',
        system: 'You are helpful.',
        tools: [{ name: 'search', description: 'd', input_schema: {} }],
      },
      { usage: { input_tokens: 100, output_tokens: 42, cache_read_input_tokens: 80 } },
    );
    expect(captured).not.toBeNull();
    expect(captured!.model).toBe('claude-sonnet-5');
    expect(captured!.system).toBe('You are helpful.');
    expect(captured!.tools).toHaveLength(1);
    expect(captured!.observedOutputTokens).toBe(42);
    expect(captured!.observedCacheReadTokens).toBe(80);
  });

  it('joins a system given as text blocks', () => {
    const captured = anthropicAdapter.extract({
      model: 'claude-sonnet-5',
      system: [
        { type: 'text', text: 'Line one.' },
        { type: 'text', text: 'Line two.' },
      ],
    });
    expect(captured!.system).toBe('Line one.\nLine two.');
  });

  it('returns null for a non-request', () => {
    expect(anthropicAdapter.extract(null)).toBeNull();
    expect(anthropicAdapter.extract({ foo: 'bar' })).toBeNull();
  });
});

describe('openai adapter', () => {
  it('extracts model, system/developer messages, tools and completion tokens', () => {
    const captured = openaiAdapter.extract(
      {
        model: 'gpt-5',
        messages: [
          { role: 'developer', content: 'Follow the rules.' },
          { role: 'system', content: 'Be terse.' },
          { role: 'user', content: 'hi' },
        ],
        tools: [{ type: 'function', function: { name: 'lookup', description: 'd', parameters: {} } }],
      },
      { usage: { prompt_tokens: 200, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 50 } } },
    );
    expect(captured!.model).toBe('gpt-5');
    expect(captured!.system).toBe('Follow the rules.\nBe terse.');
    expect(captured!.tools).toHaveLength(1);
    expect(captured!.observedOutputTokens).toBe(30);
    expect(captured!.observedCacheReadTokens).toBe(50);
  });

  it('supports the Responses API shape (instructions + output_tokens)', () => {
    const captured = openaiAdapter.extract(
      { model: 'gpt-5', instructions: 'System instructions here.', input: 'hi' },
      { usage: { input_tokens: 100, output_tokens: 25, input_tokens_details: { cached_tokens: 10 } } },
    );
    expect(captured!.system).toBe('System instructions here.');
    expect(captured!.observedOutputTokens).toBe(25);
    expect(captured!.observedCacheReadTokens).toBe(10);
  });

  it('extracts instructions given as an input-item array', () => {
    const captured = openaiAdapter.extract({
      model: 'gpt-5',
      instructions: [
        { type: 'input_text', text: 'Rule one.' },
        { type: 'input_text', text: 'Rule two.' },
      ],
    });
    expect(captured!.system).toBe('Rule one.\nRule two.');
  });

  it('extracts system/developer items carried inside the Responses `input` array', () => {
    const captured = openaiAdapter.extract({
      model: 'gpt-5',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: 'System rules.' }] },
        { role: 'developer', content: 'Be terse.' },
        { role: 'user', content: [{ type: 'input_text', text: 'ignore me' }] },
      ],
    });
    expect(captured!.system).toBe('System rules.\nBe terse.');
  });
});
