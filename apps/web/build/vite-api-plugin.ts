// Dev-only Vite plugin: serves /api/* through the same Vercel function files
// (api/**/*.ts, `export default { fetch(request) }`) so the client can always
// call /api/... — in dev and in production. Files/dirs starting with `_` are
// helpers, not routes (same rule as Vercel).

import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

const ROUTE_RE = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

function resolveRouteFile(apiDir: string, routePath: string): string | null {
  if (!ROUTE_RE.test(routePath)) return null;
  if (routePath.split('/').some((seg) => seg === '' || seg.startsWith('_'))) return null;
  const file = path.join(apiDir, `${routePath}.ts`);
  return file.startsWith(apiDir + path.sep) && fs.existsSync(file) ? file : null;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? new Uint8Array(await readBody(req)) : undefined;
  return new Request(url, { method, headers, body });
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function devApiPlugin(apiDir: string): Plugin {
  return {
    name: 'weatherchaser-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (!pathname.startsWith('/api/')) return next();
        const file = resolveRouteFile(apiDir, pathname.slice('/api/'.length));
        if (!file) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod.default as { fetch?: (r: Request) => Promise<Response> } | undefined;
          if (!handler?.fetch) return next();
          await sendWebResponse(res, await handler.fetch(await toWebRequest(req)));
        } catch (err) {
          server.config.logger.error(`[dev-api] ${pathname}: ${err instanceof Error ? err.stack : String(err)}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'dev_api_error' }));
        }
      });
    },
  };
}
