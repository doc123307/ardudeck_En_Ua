/**
 * The slice of the MediaMTX control API the media engine uses.
 *
 * Kept apart from the engine so the HTTP details are testable. One of them
 * mattered: paths are removed with DELETE. The engine used POST, the hub answered
 * 404, and every feed that was ever opened kept being pulled until the app closed.
 */

export type RtspTransport = 'automatic' | 'tcp' | 'udp';

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class HubApi {
  constructor(private readonly base: string, private readonly fetchImpl: Fetch = fetch as unknown as Fetch) {}

  /** True when a hub answers on the API port. */
  async alive(): Promise<boolean> {
    try {
      return (await this.fetchImpl(`${this.base}/v3/paths/list`)).ok;
    } catch {
      return false;
    }
  }

  /**
   * Register (or re-point) a pull-source path. `replace` rather than `add`, so a
   * retry or a transport switch for the same source upserts instead of failing
   * with "path already exists".
   */
  async setPath(name: string, source: string, rtspTransport: RtspTransport = 'automatic'): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.base}/v3/config/paths/replace/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 'automatic' negotiates UDP then falls back to TCP. Forcing 'udp' silently
        // fails against TCP-only sources, so it is an explicit opt-in only.
        body: JSON.stringify({ source, sourceOnDemand: false, rtspTransport }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Stop pulling a path. Best-effort: a path that is already gone is fine. */
  async removePath(name: string): Promise<void> {
    try {
      await this.fetchImpl(`${this.base}/v3/config/paths/delete/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch {
      /* hub down: nothing left to remove */
    }
  }

  /**
   * Whether the hub still has this path configured: true, false, or null when the
   * hub does not answer. A path can vanish under a live session when the hub is
   * restarted or reloads its configuration.
   */
  async hasPath(name: string): Promise<boolean | null> {
    try {
      const res = await this.fetchImpl(`${this.base}/v3/config/paths/get/${encodeURIComponent(name)}`);
      if (res.ok) return true;
      return res.status === 404 ? false : null;
    } catch {
      return null;
    }
  }

  /** Names of every path configured on the hub (first page is plenty: a handful of cameras). */
  async configuredPaths(): Promise<string[]> {
    try {
      const res = await this.fetchImpl(`${this.base}/v3/config/paths/list?itemsPerPage=1000`);
      if (!res.ok) return [];
      const body = (await res.json()) as { items?: Array<{ name?: unknown }> };
      return (body.items ?? []).map((item) => item.name).filter((name): name is string => typeof name === 'string');
    } catch {
      return [];
    }
  }
}
