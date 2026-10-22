const ids = Object.fromEntries(["credits","reputation","queued","failed","processing","completed","dispatchStatus","orders","events","dispatcher","capacity","capacityLevel","launch"].map(id => [id, document.getElementById(id)]));
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
function render(state) {
  ids.credits.textContent = money(state.credits);
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
    el.className = "entry";
    const name = document.createElement("span");
    name.textContent = "#" + order.id + " · " + (order.source === "manual" ? "ручной" : "авто");
    const status = document.createElement("span");
    status.textContent = ({queued:"Ожидает",processing:"В пути",completed:"Доставлен",failed:"Ошибка"}[order.status] || order.status);
    el.append(name,status);
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
