// Overlaya Studio: local server for the studio and overlay pages
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { TikTokManager, SimulatedManager } = require("./tiktok");

function startServer({ port, dataDir, htmlPath, simulate }){
  const html = fs.readFileSync(htmlPath, "utf8");
  const cfgRe = /(<script type="application\/json" id="cfg">)([\s\S]*?)(<\/script>)/;
  const defaults = JSON.parse(html.match(cfgRe)[2]);
  const builtInLogos = defaults.logos || {};
  const file = path.join(dataDir, "settings.json");

  let store = null;
  try { store = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  const withLogos = s => Object.assign({}, s || defaults, { logos: builtInLogos });
  const save = s => {
    const copy = Object.assign({}, s); delete copy.logos;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(copy));
    fs.renameSync(file + ".tmp", file);
  };

  const page = () => {
    const json = JSON.stringify(withLogos(store)).replace(/</g, "\\u003c");
    return html
      .replace(cfgRe, (m, a, b, c) => a + "\n" + json + "\n" + c)
      .replace("<head>", '<head>\n<script id="ovdesk">window.OVERLAYA_DESKTOP = { port: ' + port + ' };</script>');
  };

  const tt = simulate ? new SimulatedManager() : new TikTokManager();
  const clients = new Set();
  const send = msg => {
    const text = JSON.stringify(msg, (k, v) => typeof v === "bigint" ? String(v) : v);
    clients.forEach(ws => { if (ws.readyState === 1) ws.send(text); });
  };
  tt.on("status", st => send({ kind: "status", ...st }));
  tt.on("event", ev => send({ kind: "tiktok", type: ev.type, data: ev.data }));

  const readBody = req => new Promise((res, rej) => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on("end", () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } });
  });
  const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/studio" || /^\/overlay\/(plug|chat|shoutout)\/?$/.test(url.pathname))){
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(page());
      }
      if (url.pathname === "/api/settings" && req.method === "POST"){
        const body = await readBody(req);
        if (!body || !body.profiles) return json(res, 400, { ok: false });
        store = body; save(store);
        send({ kind: "settings" });
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/connect" && req.method === "POST"){
        const body = await readBody(req);
        tt.start(body.user, body.key);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/disconnect" && req.method === "POST"){
        await tt.stop();
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/status") return json(res, 200, tt.status());
      res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found");
    } catch (e){
      json(res, 500, { ok: false, error: String(e.message || e) });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/events")) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => {
      clients.add(ws);
      ws.on("close", () => clients.delete(ws));
      ws.send(JSON.stringify({ kind: "status", ...tt.status() }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      // reconnect automatically when the app opens, if a username is saved
      try {
        const p = store && store.profiles && store.profiles.tiktok;
        if (p && p.tiktok && p.tiktok.user && p.tiktok.on !== false) tt.start(p.tiktok.user, p.tiktok.key);
      } catch (e) {}
      resolve({
        close: () => { tt.stop(true); wss.close(); server.close(); },
      });
    });
  });
}

module.exports = { startServer };

// run directly for testing: node server.js [--simulate]
if (require.main === module){
  startServer({
    port: 21510,
    dataDir: path.join(__dirname, ".devdata"),
    htmlPath: path.join(__dirname, "overlaya.html"),
    simulate: process.argv.includes("--simulate"),
  }).then(() => console.log("Overlaya Studio running at http://127.0.0.1:21510/studio"));
}
