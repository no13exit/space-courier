// Rusty Comet: one shared order queue, real async processing, no simulated success counters.
export class Game {
  constructor(saved = {}) {
    this.credits = saved.credits ?? 0;
    this.reputation = saved.reputation ?? 100;
    this.automation = saved.automation ?? false;
    this.capacity = saved.capacity ?? 1;
    this.orders = saved.orders ?? [];
    this.nextId = saved.nextId ?? 1;
    this.lastCreated = saved.lastCreated ?? Date.now();
    this.lastStep = Date.now();
    // A restart interrupts active deliveries; return them to the queue.
    for (const order of this.orders) {
      if (order.status === "processing") {
        order.status = "queued";
        order.startedAt = null;
      }
    }
    this.events = [];
  }

  get queue() { return this.orders.filter(order => order.status === "queued"); }
  get active() { return this.orders.filter(order => order.status === "processing"); }
  get completed() { return this.orders.filter(order => order.status === "completed"); }
  get failed() { return this.orders.filter(order => order.status === "failed"); }

  event(type, order, detail = "") {
    const entry = {at: new Date().toISOString(), type, transferId: order?.id ?? null, detail};
    this.events.push(entry);
    if (this.events.length > 70) this.events.shift();
    console.log(JSON.stringify(entry));
  }

  launch(source = "manual", now = Date.now()) {
    // Keep enough history for a useful UI, but avoid unbounded storage.
    if (this.orders.length >= 1000) {
      this.orders = this.orders.filter(o => o.status === "queued" || o.status === "processing")
        .concat(this.orders.filter(o => o.status !== "queued" && o.status !== "processing").slice(-250));
    }
    if (this.queue.length >= 60) return null;
    const order = {id: this.nextId++, source, status:"queued", createdAt:now, startedAt:null,
      finishedAt:null, reward:5};
    this.orders.push(order);
    this.event("transfer_queued", order, source);
    return order;
  }

  purchase(item) {
    if (item === "dispatcher") {
      if (this.automation || this.credits < 50) return false;
      this.credits -= 50;
      this.automation = true;
    } else if (item === "capacity") {
      const cost = this.capacity * 40;
      if (this.credits < cost || this.capacity >= 5) return false;
      this.credits -= cost;
      this.capacity++;
    } else return false;
    this.event("upgrade_purchased", null, item);
    return true;
  }

  tick(now = Date.now()) {
    // A dispatcher creates demand; reputation affects how frequently customers return.
    // Cap catch-up: without a running server, this does not pretend to complete real work.
    if (this.automation) {
      const interval = 2200 * (100 / Math.max(20, this.reputation));
      let created = 0;
      while (now - this.lastCreated >= interval && created < 10) {
        this.lastCreated += interval;
        this.launch("auto", this.lastCreated);
        created++;
      }
    } else this.lastCreated = now;

    // An order waiting over 12 seconds times out. Long queues cause real failures.
    for (const order of this.queue) {
      if (now - order.createdAt >= 12000) this.fail(order, now, "queue_timeout");
    }
    // Active work occupies real wall-clock time.
    for (const order of this.active) {
      if (now - order.startedAt >= 3000) {
        order.status = "completed";
        order.finishedAt = now;
        this.credits += order.reward;
        this.reputation = Math.min(100, this.reputation + 0.45);
        this.event("transfer_completed", order, `+${order.reward} credits`);
      }
    }
    while (this.active.length < this.capacity && this.queue.length) {
      const order = this.queue[0];
      order.status = "processing";
      order.startedAt = now;
      this.event("transfer_started", order);
    }
    this.lastStep = now;
  }

  fail(order, now, reason) {
    order.status = "failed";
    order.finishedAt = now;
    this.reputation = Math.max(20, this.reputation - 4);
    this.event("transfer_failed", order, reason);
  }

  snapshot() {
    return {credits:this.credits, reputation:Math.round(this.reputation*10)/10,
      automation:this.automation, capacity:this.capacity, nextId:this.nextId,
      lastCreated:this.lastCreated, orders:this.orders};
  }

  view() {
    return {...this.snapshot(), stats:{queued:this.queue.length,processing:this.active.length,
      completed:this.completed.length,failed:this.failed.length}, events:this.events.slice(-15).reverse(),
      upgrades:{dispatcher:{cost:50,owned:this.automation},
        capacity:{cost:this.capacity*40,level:this.capacity,max:5}}};
  }
}
