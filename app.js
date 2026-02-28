// Donat Drag Race — one-page demo UI
const LANES = 6;
const ROUND_SECONDS = 60;

const laneColors = [
  { hex: "#ff3b3b" }, // red
  { hex: "#2f7bff" }, // blue
  { hex: "#ffcc33" }, // yellow
  { hex: "#36ff7a" }, // green
  { hex: "#8b5bff" }, // purple
  { hex: "#ff4bd1" }, // pink
];

const carFiles = [
  "assets/car_01.png",
  "assets/car_02.png",
  "assets/car_03.png",
  "assets/car_04.png",
  "assets/car_05.png",
  "assets/car_06.png",
];

const state = {
  running: false,
  timeLeft: ROUND_SECONDS,
  bank: 0,
  round: 1,
  selectedDonate: 5,
  pos: Array.from({length: LANES}, () => 0),     // 0..1
  speed: Array.from({length: LANES}, () => 0.09 + Math.random() * 0.03),
  boost: Array.from({length: LANES}, () => 0),
};

const el = {
  lanes: document.getElementById("lanes"),
  hit: document.getElementById("hit"),
  feed: document.getElementById("feed"),
  bankValue: document.getElementById("bankValue"),
  roundValue: document.getElementById("roundValue"),
  timeValue: document.getElementById("timeValue"),
  btnStart: document.getElementById("btnStart"),
  btnReset: document.getElementById("btnReset"),
};

const laneEls = [];

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function fmt(n){ return String(n).padStart(2, "0"); }

function addFeed(name, laneIdx, amount){
  const item = document.createElement("div");
  item.className = "feed-item";

  const left = document.createElement("div");
  left.className = "feed-left";

  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = laneColors[laneIdx].hex;

  const nm = document.createElement("div");
  nm.className = "feed-name";
  nm.textContent = `${name} → L${laneIdx+1}`;

  left.appendChild(dot);
  left.appendChild(nm);

  const amt = document.createElement("div");
  amt.className = "feed-amt";
  amt.textContent = amount ? `+${amount}` : "WIN";

  item.appendChild(left);
  item.appendChild(amt);

  el.feed.prepend(item);
  while(el.feed.children.length > 7) el.feed.removeChild(el.feed.lastChild);
}

function makeLane(i){
  const lane = document.createElement("div");
  lane.className = "lane";

  const trail = document.createElement("div");
  trail.className = "trail";
  const c = laneColors[i].hex;
  trail.style.background = `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${c} 55%, ${c} 100%)`;
  trail.style.boxShadow = `0 0 18px ${c}55, 0 0 42px ${c}33`;

  const car = document.createElement("img");
  car.className = "car";
  car.alt = `Car ${i+1}`;
  car.src = carFiles[i];

  lane.appendChild(trail);
  lane.appendChild(car);
  return { lane, trail, car };
}

function build(){
  el.lanes.innerHTML = "";
  laneEls.length = 0;

  for(let i=0;i<LANES;i++){
    const obj = makeLane(i);
    el.lanes.appendChild(obj.lane);
    laneEls.push(obj);
  }

  el.hit.innerHTML = "";
  for(let i=0;i<LANES;i++){
    const h = document.createElement("div");
    h.className = "hit-lane";
    h.addEventListener("click", () => donateToLane(i, state.selectedDonate));
    el.hit.appendChild(h);
  }

  document.querySelectorAll("[data-d]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.selectedDonate = Number(btn.getAttribute("data-d"));
    });
  });

  el.btnStart.addEventListener("click", toggleStart);
  el.btnReset.addEventListener("click", resetRound);

  el.bankValue.textContent = state.bank;
  el.roundValue.textContent = fmt(state.round);
  el.timeValue.textContent = state.timeLeft;
}
build();

function toggleStart(){
  state.running = !state.running;
  el.btnStart.textContent = state.running ? "Пауза" : "Старт";
}

function resetRound(){
  state.running = false;
  state.timeLeft = ROUND_SECONDS;
  state.bank = 0;
  state.pos = state.pos.map(()=>0);
  state.boost = state.boost.map(()=>0);
  state.speed = state.speed.map(()=>0.09 + Math.random()*0.03);
  el.feed.innerHTML = "";
  el.bankValue.textContent = state.bank;
  el.timeValue.textContent = state.timeLeft;
  el.btnStart.textContent = "Старт";
  render();
}

function donateToLane(laneIdx, amount){
  state.bank += amount;
  el.bankValue.textContent = state.bank;

  const b = amount <= 1 ? 0.03 : amount <= 5 ? 0.06 : amount <= 20 ? 0.12 : 0.20;
  state.boost[laneIdx] = clamp(state.boost[laneIdx] + b, 0, 0.42);

  const names = ["pluto","dima","katya","neo","vova","queen","ghost","max"];
  addFeed(names[Math.floor(Math.random()*names.length)], laneIdx, amount);

  const { trail, car } = laneEls[laneIdx];
  trail.style.filter = `drop-shadow(0 0 28px ${laneColors[laneIdx].hex})`;
  car.style.filter = `drop-shadow(0 10px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 22px ${laneColors[laneIdx].hex}77)`;
  setTimeout(()=>{
    trail.style.filter = `drop-shadow(0 0 18px rgba(255,255,255,0.10))`;
    car.style.filter = `drop-shadow(0 10px 18px rgba(0,0,0,0.55))`;
  }, 250);
}

let last = performance.now();
function tick(now){
  const dt = (now - last) / 1000;
  last = now;

  if(state.running){
    state.timeLeft -= dt;
    if(state.timeLeft <= 0){
      state.timeLeft = 0;
      state.running = false;
      el.btnStart.textContent = "Старт";
      const winner = state.pos.indexOf(Math.max(...state.pos));
      addFeed("SYSTEM", winner, 0);
    }
    el.timeValue.textContent = Math.ceil(state.timeLeft);

    for(let i=0;i<LANES;i++){
      const v = state.speed[i] + state.boost[i];
      state.pos[i] = clamp(state.pos[i] + v * dt * 0.22, 0, 1);
      state.boost[i] = Math.max(0, state.boost[i] - dt * 0.12);
    }
  }

  render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function render(){
  for(let i=0;i<LANES;i++){
    const p = state.pos[i];
    const { trail, car } = laneEls[i];

    trail.style.height = (p * 100).toFixed(2) + "%";
    car.style.bottom = (p * 100).toFixed(2) + "%";

    const intensity = clamp(state.boost[i] / 0.42, 0, 1);
    trail.style.opacity = (0.60 + intensity * 0.40).toFixed(2);
    trail.style.filter = `drop-shadow(0 0 ${18 + intensity*24}px ${laneColors[i].hex}66)`;
  }
}

// Demo auto-donates (remove in production)
function demoDonate(){
  if(!state.running) return;
  if(Math.random() < 0.10){
    donateToLane(Math.floor(Math.random()*LANES), [1,5,20,50][Math.floor(Math.random()*4)]);
  }
}
setInterval(demoDonate, 600);
