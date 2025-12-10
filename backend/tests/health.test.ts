import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Health endpoint', () => {
  it('GET /health should return ok', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});

