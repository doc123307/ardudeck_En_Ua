/**
 * What people type into "camera address": a bare host, `host:port`, or a whole url
 * pasted from the browser. All of them mean the same thing, so all of them are taken.
 *
 * Treating `192.168.88.117:3002` as a host produced `http://[192.168.88.117:3002]`
 * (anything with a colon was taken for IPv6) and the baffling "Invalid URL".
 */

export interface ControlAddress {
  /** Host only; an IPv6 address comes back in brackets, ready for a url. */
  host: string;
  /** Port given with the host, if any. */
  port?: number;
  /** True when the address was typed with https://. */
  https?: boolean;
}

export function parseControlAddress(input: string | undefined): ControlAddress | null {
  let text = (input ?? '').trim();
  if (!text) return null;

  let https: boolean | undefined;
  const scheme = /^(https?):\/\//i.exec(text);
  if (scheme) {
    https = scheme[1]!.toLowerCase() === 'https';
    text = text.slice(scheme[0].length);
  }
  // Drop a login, a path, a query: only the host and port matter here.
  text = text.replace(/^[^/@]*@/, '').replace(/[/?#].*$/, '');
  if (!text) return null;

  let host = text;
  let port: number | undefined;
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(text);
  if (bracketed) {
    host = `[${bracketed[1]}]`;
    if (bracketed[2]) port = Number(bracketed[2]);
  } else if ((text.match(/:/g) ?? []).length > 1) {
    // Several colons and no brackets: a bare IPv6 address.
    host = `[${text}]`;
  } else {
    const withPort = /^([^:]+):(\d+)$/.exec(text);
    if (withPort) {
      host = withPort[1]!;
      port = Number(withPort[2]);
    } else {
      host = text.replace(/:$/, '');
    }
  }
  if (port !== undefined && (port < 1 || port > 65535)) port = undefined;
  return { host, ...(port !== undefined ? { port } : {}), ...(https !== undefined ? { https } : {}) };
}

/**
 * `scheme://host[:port]` for a camera's control API. The port field wins over a port
 * typed with the address; https is on when either says so.
 */
export function controlBase(address: string | undefined, portField: number | undefined, httpsField: boolean | undefined, fallbackHost?: string): string | null {
  const parsed = parseControlAddress(address) ?? parseControlAddress(fallbackHost);
  if (!parsed) return null;
  const https = httpsField ?? parsed.https ?? false;
  const defaultPort = https ? 443 : 80;
  const port = portField ?? parsed.port ?? defaultPort;
  return `${https ? 'https' : 'http'}://${parsed.host}${port === defaultPort ? '' : `:${port}`}`;
}
