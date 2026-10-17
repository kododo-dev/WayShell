/** The host no longer accepts the user's session, so the request never reached the API. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

/** The host does not let the current user make this request. */
export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

/** The API turned the request down with problem details (400, 404, 409); `messages` are its field errors, or its detail. */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  /** Field errors by field, e.g. `{ 'translations[2].culture': ['...'] }`; empty when the problem has none. */
  readonly errors: Record<string, string[]>;

  constructor(status: number, messages: string[], errors: Record<string, string[]> = {}) {
    super(messages.join(' '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.errors = errors;
  }
}

/** Client of a Way's API (Reiho requests: `POST {apiBase}/{RequestName}` with a JSON body). */
export interface WayApi {
  /**
   * Sends the request and returns its JSON result, or `undefined` for 204. Throws {@link ApiError},
   * {@link ForbiddenError} or {@link SessionExpiredError}; the last one also opens the shell's dialog.
   */
  post<T = void>(request: string, body?: unknown, init?: RequestInit): Promise<T>;
  /** URL of a request, e.g. for a download link or an EventSource. */
  url(request: string): string;
}

const sessionExpiredListeners = new Set<() => void>();

/** Called whenever a request finds the session expired; returns the unsubscribe function. */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

async function toError(res: Response): Promise<Error> {
  if (!res.headers.get('Content-Type')?.includes('application/problem+json')) return new Error(`${res.status} ${res.statusText}`);
  const problem = (await res.json()) as ProblemDetails;
  const messages = problem.errors
    ? Object.values(problem.errors).flat()
    : [problem.detail ?? problem.title ?? `${res.status} ${res.statusText}`];
  return new ApiError(res.status, messages, problem.errors ?? {});
}

export function createApi(apiBase: string): WayApi {
  const url = (request: string) => `${apiBase.replace(/\/$/, '')}/${request.replace(/^\//, '')}`;
  return {
    url,
    async post<T>(request: string, body?: unknown, init?: RequestInit): Promise<T> {
      const res = await fetch(url(request), {
        method: 'POST',
        ...init,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init?.headers },
        body: JSON.stringify(body ?? {}),
      });

      // Cookie authentication usually redirects an expired session to a sign-in page, which fetch follows and gets
      // back as HTML; a 401 means the same.
      const isJson = res.headers.get('Content-Type')?.includes('json') ?? false;
      if (res.status === 401 || (res.ok && res.redirected && !isJson)) {
        sessionExpiredListeners.forEach((listener) => listener());
        throw new SessionExpiredError();
      }
      if (res.status === 403) throw new ForbiddenError();
      if (!res.ok) throw await toError(res);

      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
  };
}
