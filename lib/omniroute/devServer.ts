import { loadEnv, type Plugin } from "vite";

const ROUTES: Record<string, string> = {
  "/api/omniroute-status": "/api/omniroute-status.ts",
  "/api/omniroute-intel": "/api/omniroute-intel.ts",
};
const MAX_BODY_BYTES = 2_000_000;

/** Run the real server handlers locally, before Vite's production API proxy. */
export function omniRouteDevApi(): Plugin {
  return {
    name: "omniroute-dev-api",
    configureServer(server) {
      // These variables stay in the Node process; never add them to Vite's define/envPrefix.
      Object.assign(process.env, loadEnv(server.config.mode, server.config.envDir, "OMNIROUTE_"));

      server.middlewares.use(async (req, res, next) => {
        const route = ROUTES[(req.url ?? "").split("?")[0]];
        if (!route) return next();

        const send = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        };

        try {
          let body: unknown;
          if (req.method === "POST" && route === ROUTES["/api/omniroute-intel"]) {
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of req) {
              const buffer = Buffer.from(chunk);
              bytes += buffer.length;
              if (bytes > MAX_BODY_BYTES) {
                send(413, { ok: false, error: "payload_too_large", message: "Request is too large." });
                return;
              }
              chunks.push(buffer);
            }
            try {
              const raw = Buffer.concat(chunks).toString("utf8");
              body = raw ? JSON.parse(raw) : undefined;
            } catch {
              send(400, { ok: false, error: "invalid_json", message: "Send a valid JSON body." });
              return;
            }
          }

          const { default: handler } = await server.ssrLoadModule(route);
          await handler({ method: req.method, body }, {
            status: (code: number) => ({ json: (payload: unknown) => send(code, payload) }),
          });
        } catch {
          send(500, { ok: false, error: "gateway_error", message: "Local OmniRoute request failed." });
        }
      });
    },
  };
}
