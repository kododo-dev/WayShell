import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ForbiddenError, SessionExpiredError, createApi, onSessionExpired } from '../src/index.js';

function respond(body: string, init: ResponseInit & { redirected?: boolean } = {}) {
  const response = new Response(body || null, init);
  if (init.redirected) Object.defineProperty(response, 'redirected', { value: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  return vi.mocked(fetch);
}

afterEach(() => vi.unstubAllGlobals());

describe('createApi', () => {
  const api = createApi('/config/api/');

  it('posts the request as JSON to {apiBase}/{request}', async () => {
    const fetchMock = respond('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });

    expect(await api.post('GetSettings', { section: 'smtp' })).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/config/api/GetSettings');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"section":"smtp"}');
  });

  it('returns undefined for 204', async () => {
    respond('', { status: 204 });
    expect(await api.post('UpdateSettings')).toBeUndefined();
  });

  it('turns problem details into ApiError with the field errors', async () => {
    respond(JSON.stringify({ title: 'Invalid', errors: { culture: ['Unknown culture.'] } }), {
      status: 400,
      headers: { 'Content-Type': 'application/problem+json' },
    });

    const error = await api.post('AddCulture').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).messages).toEqual(['Unknown culture.']);
    expect((error as ApiError).errors).toEqual({ culture: ['Unknown culture.'] });
  });

  it('uses the detail of a problem without field errors', async () => {
    respond(JSON.stringify({ title: 'Conflict', detail: 'Already there.' }), { status: 409, headers: { 'Content-Type': 'application/problem+json' } });
    await expect(api.post('AddCulture')).rejects.toThrow('Already there.');
  });

  it('reports 403 as ForbiddenError', async () => {
    respond('', { status: 403 });
    await expect(api.post('AddCulture')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each([
    ['401', () => respond('', { status: 401 })],
    ['a redirect to an HTML sign-in page', () => respond('<html>', { status: 200, redirected: true, headers: { 'Content-Type': 'text/html' } })],
  ])('reports %s as an expired session to every listener', async (_, setup) => {
    setup();
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(api.post('GetSettings')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('builds request URLs', () => {
    expect(api.url('/Stream')).toBe('/config/api/Stream');
  });
});
