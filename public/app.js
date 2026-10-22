const ids = Object.fromEntries(["credits","reputation","queued","failed","processing","completed","dispatchStatus","orders","events","dispatcher","capacity","capacityLevel","launch","dispatcherLogs","workerLogs","logHint","dispatchBar","dispatchPercent","reputationBar","reputationPercent"].map(id => [id, document.getElementById(id)]));
const money = number => Math.floor(number).toLocaleString("ru-RU");
async function action(path) {
  const response = await fetch(path,{method:"POST"});
  const state = await response.json();
  if (!response.ok) { alert(state.error || "Ошибка"); return; }
  render(state);
}
ids.launch.onclick = () => action("/api/launch");
ids.dispatcher.onclick = () => action("/api/buy/dispatcher");
ids.capacity.onclick = () => action("/api/buy/capacity");
ids.dispatcherLogs.onclick = () => action("/api/buy/dispatcherLogs");
ids.workerLogs.onclick = () => action("/api/buy/workerLogs");
function render(state) {
  ids.credits.textContent = money(state.credits);
  const reputation = Math.max(0, Math.min(100, state.reputation));
  ids.reputationBar.style.width = reputation + "%";
  ids.reputationPercent.textContent = reputation.toFixed(1) + "%";
  const dispatchProgress = state.automation ? Math.min(100, Math.max(0, (state.now - state.lastCreated) / state.dispatchInterval * 100)) : 0;
  ids.dispatchBar.style.width = dispatchProgress + "%";
  ids.dispatchPercent.textContent = state.automation ? Math.floor(dispatchProgress) + "%" : "Неактивен";
  for (const [key,source] of [["dispatcherLogs","dispatcher"],["workerLogs","worker"]]) {
    const upgrade = state.upgrades[key];
    ids[key].disabled = upgrade.owned || state.credits < upgrade.cost;
    ids[key].textContent = upgrade.owned ? "Установлен" : upgrade.cost + " ¢";
  }
  ids.logHint.textContent = state.collectors.dispatcher || state.collectors.worker ?
    "Активны: " + [state.collectors.dispatcher ? "диспетчер" : null,state.collectors.worker ? "обработчик" : null].filter(Boolean).join(", ") :
    "Без сборщиков логи недоступны. Покупай инструменты, чтобы понять причины ошибок.";
  ids.reputation.textContent = state.reputation.toFixed(1) + "%";
  for (const key of ["queued","failed","processing","completed"]) ids[key].textContent = state.stats[key];
  ids.dispatchStatus.textContent = state.automation ? "Автодиспетчер включён. Новые заказы поступают автоматически." : "Автодиспетчер ещё не куплен.";
  ids.dispatcher.textContent = state.automation ? "Куплен" : "50 ¢";
  ids.dispatcher.disabled = state.automation || state.credits < 50;
  ids.capacity.textContent = state.capacity >= 5 ? "Максимум" : money(state.upgrades.capacity.cost) + " ¢";
  ids.capacity.disabled = state.capacity >= 5 || state.credits < state.upgrades.capacity.cost;
  ids.capacityLevel.textContent = "Параллельных доставок: " + state.capacity;
  ids.orders.replaceChildren(...state.orders.slice(-12).reverse().map(order => {
    const el = document.createElement("div");
    el.className = "transfer";
    const label = document.createElement("div");
    label.className = "progress-label";
    const name = document.createElement("span");
    name.textContent = "#" + order.id + " · " + (order.source === "manual" ? "ручной" : "авто");
    const status = document.createElement("span");
    status.textContent = ({queued:"Ожидает",processing:"В пути",completed:"Доставлен",failed:"Ошибка"}[order.status] || order.status);
    label.append(name,status);
    const track = document.createElement("div");
    track.className = "bar";
    const fill = document.createElement("div");
    const progress = order.status === "completed" ? 100 :
      order.status === "failed" ? Math.min(100,(order.finishedAt-order.createdAt)/state.timeoutMs*100) :
      order.status === "processing" ? Math.min(99, (state.now-order.startedAt)/state.processingMs*100) :
      Math.min(99,(state.now-order.createdAt)/state.timeoutMs*100);
    fill.style.width = Math.max(0,progress) + "%";
    fill.className = order.status === "failed" ? "failed" : order.status === "queued" ? "queued" : "";
    track.append(fill);
    el.append(label,track);
    return el;
  }));
  ids.events.replaceChildren(...state.events.map(event => {
    const el = document.createElement("div");
    el.className="entry";
    const time=document.createElement("span");
    time.textContent=new Date(event.at).toLocaleTimeString("ru-RU");
    const eventText=document.createElement("span");
    eventText.textContent=event.type+(event.transferId!==null?" #"+event.transferId:"");
    el.append(time,eventText);
    return el;
  }));
}
async function refresh(){try { const r=await fetch("/api/state");if(r.ok)render(await r.json());}catch{ /* retry while server starts */ }}
refresh();
setInterval(refresh,1000);
