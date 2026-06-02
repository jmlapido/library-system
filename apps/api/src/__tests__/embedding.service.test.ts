import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock db to prevent actual DB calls
vi.mock('../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

// Mock openai module — lazy client means the mock must intercept the constructor
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: { create: mockCreate },
    })),
  };
});

afterEach(() => {
  vi.resetModules();
});

describe('buildBookText', () => {
  it('joins all non-null fields with period-space separator', async () => {
    const { buildBookText } = await import('../services/embedding.service.js');
    const result = buildBookText({ title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', description: 'Desert planet story' });
    expect(result).toBe('Dune. Frank Herbert. Sci-Fi. Desert planet story');
  });

  it('skips null fields', async () => {
    const { buildBookText } = await import('../services/embedding.service.js');
    const result = buildBookText({ title: 'Dune', author: null, genre: null, description: null });
    expect(result).toBe('Dune');
  });

  it('handles title and author only', async () => {
    const { buildBookText } = await import('../services/embedding.service.js');
    const result = buildBookText({ title: 'A', author: 'B', genre: null, description: null });
    expect(result).toBe('A. B');
  });
});

describe('generateEmbedding', () => {
  it('returns null when OPENAI_API_KEY is not set', async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { generateEmbedding } = await import('../services/embedding.service.js');
    const result = await generateEmbedding('test text');
    expect(result).toBeNull();

    if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
  });

  it('calls OpenAI and returns embedding array when API key is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key';

    const { generateEmbedding } = await import('../services/embedding.service.js');
    const result = await generateEmbedding('some book text');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([0.1, 0.2, 0.3]);

    delete process.env.OPENAI_API_KEY;
  });
});

describe('findSimilarBooks', () => {
  it('returns empty array when OPENAI_API_KEY is not set', async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { findSimilarBooks } = await import('../services/embedding.service.js');
    const result = await findSimilarBooks('query', 'school-id', 10);
    expect(result).toEqual([]);

    if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
  });
});
