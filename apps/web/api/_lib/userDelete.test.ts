import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const calls: string[] = [];
let feedbackError: { message: string } | null = null;
let deleteUserError: { message: string } | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`auth.deleteUser:${id}`);
          return { error: deleteUserError };
        },
      },
    },
    from: (table: string) => ({
      delete: () => ({
        eq: async (col: string, val: string) => {
          calls.push(`${table}.delete:${col}=${val}:${key}`);
          return { error: feedbackError };
        },
      }),
    }),
  }),
}));

const handler = (await import('../user/delete.ts')).default;

const req = () =>
  new Request('http://x/api/user/delete', { method: 'DELETE', headers: { authorization: 'Bearer tok' } });

describe('DELETE /api/user/delete', () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

  beforeEach(() => {
    calls.length = 0;
    feedbackError = null;
    deleteUserError = null;
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SUPABASE_URL', 'http://sb');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc');
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '');
    vi.stubEnv('POSTHOG_PROJECT_ID', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deletes the feedback rows before the auth user', async () => {
    const res = await handler.fetch(req());
    expect(res.status).toBe(200);
    expect(calls).toEqual(['feedback.delete:user_id=user-1:svc', 'auth.deleteUser:user-1']);
  });

  it('aborts without deleting the auth user when feedback deletion fails', async () => {
    feedbackError = { message: 'boom' };
    const res = await handler.fetch(req());
    expect(res.status).toBe(500);
    expect(calls.some((c) => c.startsWith('auth.deleteUser'))).toBe(false);
    expect(await res.text()).not.toContain('boom');
  });

  it('returns a generic error when the auth user cannot be deleted (no raw message)', async () => {
    deleteUserError = { message: 'Database error deleting user: secret detail' };
    const res = await handler.fetch(req());
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('secret detail');
    expect(JSON.parse(body)).toEqual({ error: 'Could not delete account' });
  });

  it('does not call PostHog without the env vars', async () => {
    await handler.fetch(req());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the PostHog EU person deletion when env is set, without leaking the key', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_secret');
    vi.stubEnv('POSTHOG_PROJECT_ID', '123');
    const res = await handler.fetch(req());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://eu.posthog.com/api/projects/123/persons/bulk_delete/');
    expect(JSON.parse(init.body as string)).toEqual({
      distinct_ids: ['user-1'],
      delete_events: true,
      delete_recordings: true,
    });
    expect(await res.text()).not.toContain('phx_secret');
  });

  it('ignores PostHog failures', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_secret');
    vi.stubEnv('POSTHOG_PROJECT_ID', '123');
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const res = await handler.fetch(req());
    expect(res.status).toBe(200);
  });
});
