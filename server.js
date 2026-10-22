import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {Game} from "./game.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const savePath = path.join(root, "state.json");
let saved = {};
try { saved = JSON.parse(fs.readFileSync(savePath, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const game = new Game(saved);
const port = Number(process.env.PORT || 3001);

function save() {
  const temporary = savePath + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(game.snapshot(), null, 2));
  fs.renameSync(temporary, savePath);
}
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8"};

const server = http.createServer((req, res) => {
  const respond = (code, body) => {
    res.writeHead(code, {"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    res.end(JSON.stringify(body));
  };
  if (req.url === "/api/state" && req.method === "GET") return respond(200, game.view());
  if (req.url === "/api/launch" && req.method === "POST") {
    const order = game.launch();
    game.tick();
    if (order) save();
    return respond(order ? 200 : 409, order ? game.view() : {error:"Очередь переполнена"});
  }
  if (req.url === "/api/burst" && req.method === "POST") {
    const success = game.burst();
    if (success) { game.tick(); save(); }
    return respond(success ? 200 : 409, success ? game.view() : {error:"Нужен планировщик или тест ещё на перезарядке"});
  }
  if (req.url === "/api/pause" && req.method === "POST") {
    const success = game.toggleDispatcher();
    if (success) save();
    return respond(success ? 200 : 409, success ? game.view() : {error:"Сначала купите планировщик"});
  }
  if (req.url?.startsWith("/api/buy/") && req.method === "POST") {
    const key = req.url.slice("/api/buy/".length);
    const success = game.purchase(key);
    if (success) { game.tick(); save(); }
    return respond(success ? 200 : 409, success ? game.view() : {error:"Недостаточно кредитов или покупка недоступна"});
  }
  if (req.method !== "GET") return respond(404, {error:"Not found"});
  const requested = req.url === "/" ? "index.html" : decodeURIComponent((req.url || "").slice(1));
  const allowed = ["index.html","app.js","style.css"];
  if (!allowed.includes(requested)) return respond(404,{error:"Not found"});
  const file = path.join(root, "public", requested);
  res.writeHead(200, {"content-type":types[path.extname(file)] || "text/plain","cache-control":"no-store"});
  fs.createReadStream(file).pipe(res);
});
setInterval(() => game.tick(), 250);
setInterval(save, 5000);
process.on("SIGINT", () => { save(); process.exit(0); });
server.listen(port,"127.0.0.1",()=>console.log(`Tiny Service: http://127.0.0.1:${port}`));
