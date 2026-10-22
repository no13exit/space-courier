# Rusty Comet — v0.3 playable pilot

A small idle logistics game that runs real Node.js order processing. Manual launches add work to the same queue as the auto dispatcher.

## Run

Requires Node.js 18+. Run `npm start`, then open **http://127.0.0.1:3001**.

No dependencies or API keys. Runtime game state is saved in `state.json` (gitignored).

## Mechanics

- Manual launch is always available; each completed order earns 5 credits.
- At 50 credits, buy the auto dispatcher: it generates real new orders as long as the server runs.
- Additional processing capacity costs `40 × current capacity` credits.
- Each order takes 3 seconds of wall-clock processing. Orders waiting more than 12 seconds fail.
- Failures hurt reputation; successful deliveries repair it. Reputation affects the auto-order rate.
- Progress bars show processing, queue waiting, dispatcher cadence and reputation based on actual timestamps/state.
- A statistics collector costs 25 credits and unlocks outcomes from the last 50 finished orders: successes, failures, failure rate, and average processing time. This uses actual saved order data, not invented events.
- A checkbox hides fully purchased upgrades (repeatable capacity stays visible until maxed).
- The dispatcher collector costs 20 credits; the worker collector costs 30. In-game diagnostic events are recorded and shown only for sources whose collector has been purchased. Server console logs remain available to the developer.
- Error counts derive from actual processing state. Collected events contain `transferId`.

## Scope and known limitations

This is a **local gameplay pilot**, not production infrastructure. The browser can close while the Node server continues working. Turning off the server stops processing. Queues and processing are currently in one Node process; persistent snapshots avoid losing finished orders on normal restart but are not a durable job queue.

There is no separate customer demand queue, SLA, database, Grafana, or distributed worker yet. First validate that the manual → automatic → overloaded queue loop is enjoyable and understandable before adding complexity.
