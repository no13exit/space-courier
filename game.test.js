import test from "node:test";
import assert from "node:assert/strict";
import {Game} from "./game.js";

test("manual deliveries complete and earn credits", () => {
  const game = new Game();
  const start = Date.now();
  const order = game.launch("manual", start);
  game.tick(start);
  assert.equal(order.status, "processing");
  game.tick(start + 3100);
  assert.equal(order.status, "completed");
  assert.equal(game.credits, 5);
});

test("dispatcher purchase creates automatic work", () => {
  const start = Date.now();
  const game = new Game({credits:50});
  assert.equal(game.purchase("dispatcher"), true);
  game.tick(start);
  game.tick(start + 2500);
  assert.ok(game.orders.some(order => order.source === "auto"));
  assert.equal(game.credits, 0);
});

test("shared capacity causes queue timeouts and reputation damage", () => {
  const game = new Game();
  const start = Date.now();
  for (let i=0;i<6;i++) game.launch("manual",start);
  game.tick(start);
  game.tick(start+12500);
  assert.ok(game.failed.length >= 1);
  assert.ok(game.reputation < 100);
});

test("capacity upgrade requires credits", () => {
  const game = new Game({credits:40});
  assert.equal(game.purchase("capacity"),true);
  assert.equal(game.capacity,2);
  assert.equal(game.credits,0);
  assert.equal(game.purchase("capacity"),false);
});

test("log collectors unlock only their own event types", () => {
  const game = new Game({credits:50});
  const start = Date.now();
  game.launch("manual",start);
  assert.equal(game.events.length,0);
  assert.equal(game.purchase("dispatcherLogs"),true);
  game.launch("manual",start);
  assert.ok(game.events.some(event => event.type === "transfer_queued"));
  game.tick(start);
  assert.equal(game.events.some(event => event.type === "transfer_started"),false);
  assert.equal(game.purchase("workerLogs"),true);
  game.tick(start+3500);
  assert.ok(game.events.some(event => event.type === "transfer_completed"));
  assert.equal(game.credits,5);
});

test("statistics are gated, reflect outcomes, and survive restart", () => {
  const start = Date.now();
  const game = new Game({credits:30});
  assert.equal(game.view().diagnostics, null);
  const order = game.launch("manual",start);
  game.tick(start);
  game.tick(start+3100);
  assert.equal(order.status,"completed");
  assert.equal(game.purchase("stats"),true);
  const d = game.view().diagnostics;
  assert.equal(d.sample,1);
  assert.equal(d.success,1);
  assert.equal(d.failed,0);
  assert.equal(d.failureRate,0);
  assert.equal(d.averageProcessingMs,3100);
  const restored = new Game(game.snapshot());
  assert.equal(restored.statsUnlocked,true);
  assert.equal(restored.view().diagnostics.success,1);
});
