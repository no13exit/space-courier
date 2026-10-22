// Rusty Comet: one shared order queue, real async processing, no simulated success counters.
export class Game {
  constructor(saved = {}) {
    this.credits = saved.credits ?? 0;
    this.reputation = saved.reputation ?? 100;
    this.automation = saved.automation ?? false;
    this.capacity = saved.capacity ?? 1;
    this.statsUnlocked = saved.statsUnlocked ?? false;
    this.collectors = saved.collectors ?? {dispatcher:false, worker:false};
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
    this.dispatchPaused = saved.dispatchPaused ?? false;
    this.burstTriggered = saved.burstTriggered ?? false;
    this.timeoutObserved = saved.timeoutObserved ?? false;
    this.recovered = saved.recovered ?? false;
    this.lastBurstAt = saved.lastBurstAt ?? 0;
  }

  get queue() { return this.orders.filter(order => order.status === "queued"); }
  get active() { return this.orders.filter(order => order.status === "processing"); }
  get completed() { return this.orders.filter(order => order.status === "completed"); }
  get failed() { return this.orders.filter(order => order.status === "failed"); }

  event(type, order, detail = "") {
    const entry = {at: new Date().toISOString(), type, transferId: order?.id ?? null, detail};
    const source = type === "transfer_queued" ? "dispatcher" : "worker";
    if (this.collectors[source]) this.events.push(entry);
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

  toggleDispatcher() {
    if (!this.automation) return false;
    this.dispatchPaused = !this.dispatchPaused;
    this.event("dispatcher_toggled", null, this.dispatchPaused ? "paused" : "resumed");
    return true;
  }

  burst(now = Date.now()) {
    if (!this.automation || now - this.lastBurstAt < 30000) return false;
    this.lastBurstAt = now;
    this.burstTriggered = true;
    for (let i = 0; i < 12; i++) this.launch("test", now);
    this.event("load_test_started", null, "12 test requests");
    return true;
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
    } else if (item === "stats") {
      if (this.statsUnlocked || this.credits < 25) return false;
      this.credits -= 25;
      this.statsUnlocked = true;
    } else if (item === "dispatcherLogs" || item === "workerLogs") {
      const source = item === "dispatcherLogs" ? "dispatcher" : "worker";
      const cost = source === "dispatcher" ? 20 : 30;
      if (this.collectors[source] || this.credits < cost) return false;
      this.credits -= cost;
      this.collectors[source] = true;
    } else return false;
    this.event("upgrade_purchased", null, item);
    return true;
  }

  tick(now = Date.now()) {
    // A dispatcher creates demand; reputation affects how frequently customers return.
    // Cap catch-up: without a running server, this does not pretend to complete real work.
    if (this.automation && !this.dispatchPaused) {
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
    if (this.timeoutObserved && this.queue.length === 0 && this.active.length === 0 && this.dispatchPaused) this.recovered = true;
    this.lastStep = now;
  }

  fail(order, now, reason) {
    if (reason === "queue_timeout") this.timeoutObserved = true;
    order.status = "failed";
    order.finishedAt = now;
    this.reputation = Math.max(20, this.reputation - 4);
    this.event("transfer_failed", order, reason);
  }

  snapshot() {
    return {credits:this.credits, reputation:Math.round(this.reputation*10)/10,
      automation:this.automation, capacity:this.capacity, nextId:this.nextId,
      lastCreated:this.lastCreated, orders:this.orders, collectors:this.collectors, statsUnlocked:this.statsUnlocked,
      dispatchPaused:this.dispatchPaused, burstTriggered:this.burstTriggered, timeoutObserved:this.timeoutObserved,
      recovered:this.recovered, lastBurstAt:this.lastBurstAt};
  }

  view() {
    const interval = 2200 * (100 / Math.max(20, this.reputation));
    const finished = this.orders.filter(order => order.status === "completed" || order.status === "failed").slice(-50);
    const successes = finished.filter(order => order.status === "completed");
    const failures = finished.length - successes.length;
    const durations = successes.filter(order => order.startedAt != null && order.finishedAt != null)
      .map(order => order.finishedAt - order.startedAt);
    const diagnostics = this.statsUnlocked ? {sample:finished.length, success:successes.length,
      failed:failures, failureRate:finished.length ? Math.round(failures / finished.length * 1000)/10 : 0,
      averageProcessingMs:durations.length ? Math.round(durations.reduce((a,b) => a+b,0)/durations.length) : null} : null;
    const now = Date.now();
    const oldestQueueMs = this.queue.length ? Math.max(0, now - this.queue[0].createdAt) : 0;
    const quests = [
      {title:"Запусти планировщик",done:this.automation,detail:"Автоматизируй поток клиентских запросов."},
      {title:"Создай перегрузку",done:this.burstTriggered,detail:"Отправь тестовый всплеск из 12 запросов."},
      {title:"Найди таймаут очереди",done:this.timeoutObserved,detail:"Дождись queue_timeout; проверь длину очереди и возраст старого запроса."},
      {title:"Восстанови сервис",done:this.recovered,detail:"Приостанови планировщик и дай очереди полностью опустеть."}
    ];
    return {...this.snapshot(), diagnostics, quests, oldestQueueMs,
      canBurst:this.automation && now - this.lastBurstAt >= 30000,
      burstCooldownMs:Math.max(0,30000-(now-this.lastBurstAt)),
      now, dispatchInterval:interval, processingMs:3000, timeoutMs:12000, stats:{queued:this.queue.length,processing:this.active.length,
      completed:this.completed.length,failed:this.failed.length}, events:this.events.slice(-15).reverse(),
      upgrades:{dispatcher:{cost:50,owned:this.automation},
        capacity:{cost:this.capacity*40,level:this.capacity,max:5},
        stats:{cost:25,owned:this.statsUnlocked},
        dispatcherLogs:{cost:20,owned:this.collectors.dispatcher},
        workerLogs:{cost:30,owned:this.collectors.worker}}};
  }
}
