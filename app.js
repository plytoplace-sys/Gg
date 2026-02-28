// Donat Drag Race — TOP SVG project (no images)
const LANES = 6;
const ROUND_SECONDS = 60;

const laneColors = ["#ff3b3b","#2f7bff","#ffcc33","#36ff7a","#8b5bff","#ff4bd1"];
const likeSets = [
  ["❤️","🔥","⚡"],
  ["💙","🌊","🌀"],
  ["💛","✨","⭐"],
  ["💚","🍀","🌿"],
  ["💜","🔮","🦄"],
  ["🩷","🌸","💫"]
];

// Road geometry in SVG coords
const road = { topY: 260, bottomY: 1680, topL: 400, topR: 680, botL: 80, botR: 1000 };

const el = {
  scene: document.getElementById("scene"),
  laneLines: document.getElementById("laneLines"),
  finishBand: document.getElementById("finishBand"),
  trails: document.getElementById("trails"),
  cars: document.getElementById("cars"),
  flash: document.getElementById("flash"),
  hit: document.getElementById("hit"),
  bankValue: document.getElementById("bankValue"),
  roundValue: document.getElementById("roundValue"),
  timeValue: document.getElementById("timeValue"),
  feed: document.getElementById("feed"),
  donorList: document.getElementById("donorList"),
  testGrid: document.getElementById("testGrid"),
  winsTotal: document.getElementById("winsTotal"),
  winsGrid: document.getElementById("winsGrid"),
  winner: document.getElementById("winner"),
  winnerLane: document.getElementById("winnerLane"),
  btnNext: document.getElementById("btnNext"),
};

const state = {
  running: false,
  timeLeft: ROUND_SECONDS,
  bank: 0,
  round: 1,
  pos: Array.from({length: LANES}, ()=>0),
  speed: Array.from({length: LANES}, ()=>0.11 + Math.random()*0.03),
  boost: Array.from({length: LANES}, ()=>0),
  winner: null,
  wins: Array.from({length: LANES}, ()=>0),
  donors: {},
};

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function fmt2(n){ return String(n).padStart(2,"0"); }

function roadY(t){ return lerp(road.bottomY, road.topY, t); }
function roadL(t){ return lerp(road.botL, road.topL, t); }
function roadR(t){ return lerp(road.botR, road.topR, t); }

function laneCenterX(i,t){
  const L = roadL(t), R = roadR(t);
  const w = (R-L)/LANES;
  let x = L + w*(i+0.5);
  x += Math.sin((t*3.2 + i*0.9)*Math.PI) * 8 * (1-t);
  return x;
}

function svgEl(name){ return document.createElementNS("http://www.w3.org/2000/svg", name); }

function buildLaneLines(){
  el.laneLines.innerHTML = "";
  for(let i=1;i<LANES;i++){
    for(let s=0;s<26;s++){
      if(s%2===1) continue;
      const t0 = s/26;
      const t1 = (s+0.55)/26;
      const y0 = lerp(road.bottomY, road.topY, t0);
      const y1 = lerp(road.bottomY, road.topY, t1);
      const tx0 = (road.bottomY - y0)/(road.bottomY-road.topY);
      const tx1 = (road.bottomY - y1)/(road.bottomY-road.topY);
      const x0 = laneCenterX(i-0.5, tx0);
      const x1 = laneCenterX(i-0.5, tx1);
      const seg = svgEl("line");
      seg.setAttribute("x1", x0); seg.setAttribute("y1", y0);
      seg.setAttribute("x2", x1); seg.setAttribute("y2", y1);
      seg.setAttribute("stroke-width", lerp(10,3,tx0));
      el.laneLines.appendChild(seg);
    }
  }
}

function buildFinishBand(){
  el.finishBand.innerHTML = "";
  const t = 1.0;
  const L = roadL(t), R = roadR(t);
  const y = roadY(t) + 22;
  const bandH = 22;
  const squares = 24;
  const w = (R-L)/squares;
  for(let i=0;i<squares;i++){
    const r = svgEl("rect");
    r.setAttribute("x", L + i*w);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", bandH);
    r.setAttribute("fill", i%2===0 ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)");
    el.finishBand.appendChild(r);
  }
}

const carNodes = [];
const trailNodes = [];

function initCars(){
  el.cars.innerHTML = "";
  el.trails.innerHTML = "";
  carNodes.length = 0;
  trailNodes.length = 0;

  for(let i=0;i<LANES;i++){
    const p = svgEl("path");
    p.setAttribute("fill","none");
    p.setAttribute("stroke", laneColors[i]);
    p.setAttribute("stroke-linecap","round");
    p.setAttribute("opacity","0.85");
    el.trails.appendChild(p);
    trailNodes.push(p);

    const u = svgEl("use");
    u.setAttributeNS("http://www.w3.org/1999/xlink","href","#carShape");
    u.setAttribute("fill", laneColors[i]);
    u.setAttribute("opacity","0.95");
    el.cars.appendChild(u);
    carNodes.push(u);
  }
}

function addFeed(name, laneIdx, amount, msg, ico){
  const item = document.createElement("div");
  item.className = "feed-item";

  const left = document.createElement("div");
  left.className = "feed-left";

  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = laneColors[laneIdx];

  const wrap = document.createElement("div");
  wrap.style.minWidth = "0";

  const nm = document.createElement("div");
  nm.className = "feed-name";
  nm.textContent = `${ico} ${name} → Полоса ${laneIdx+1}`;

  const m = document.createElement("div");
  m.className = "feed-msg";
  m.textContent = msg;

  wrap.appendChild(nm);
  wrap.appendChild(m);

  left.appendChild(dot);
  left.appendChild(wrap);

  const amt = document.createElement("div");
  amt.className = "feed-amt";
  amt.textContent = amount ? `+${amount}` : "WIN";

  item.appendChild(left);
  item.appendChild(amt);

  el.feed.prepend(item);
  while(el.feed.children.length > 10) el.feed.removeChild(el.feed.lastChild);
}

function updateTopDonors(){
  const entries = Object.entries(state.donors)
    .map(([k,v])=>({name:k, total:v}))
    .sort((a,b)=>b.total-a.total)
    .slice(0,5);

  el.donorList.innerHTML = "";
  for(const e of entries){
    const li = document.createElement("li");
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = e.name;
    const am = document.createElement("span");
    am.className = "am";
    am.textContent = e.total;
    li.appendChild(nm); li.appendChild(am);
    el.donorList.appendChild(li);
  }
  if(entries.length === 0){
    const li = document.createElement("li");
    li.style.opacity = "0.75";
    li.textContent = "Пока пусто";
    el.donorList.appendChild(li);
  }
}

function loadPersist(){
  try{
    const w = localStorage.getItem("ddr_svg_top_wins");
    if(w){
      const obj = JSON.parse(w);
      if(Array.isArray(obj.wins) && obj.wins.length === LANES){
        state.wins = obj.wins.map(x=>Number(x)||0);
      }
    }
    const d = localStorage.getItem("ddr_svg_top_donors");
    if(d){
      const obj = JSON.parse(d);
      if(obj && typeof obj === "object") state.donors = obj;
    }
  }catch(e){}
}
function savePersist(){
  try{
    localStorage.setItem("ddr_svg_top_wins", JSON.stringify({wins: state.wins}));
    localStorage.setItem("ddr_svg_top_donors", JSON.stringify(state.donors));
  }catch(e){}
}
function renderWins(){
  el.winsGrid.innerHTML = "";
  let total = 0;
  for(let i=0;i<LANES;i++){
    total += state.wins[i];
    const chip = document.createElement("div");
    chip.className = "win-chip";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = laneColors[i];

    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.textContent = `Полоса ${i+1}`;

    const val = document.createElement("div");
    val.className = "val";
    val.textContent = state.wins[i];

    chip.appendChild(dot);
    chip.appendChild(lbl);
    chip.appendChild(val);
    el.winsGrid.appendChild(chip);
  }
  el.winsTotal.textContent = total;
}

// 8-bit audio (WebAudio)
let audioCtx = null;
function getAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep({freq=880, dur=0.08, type="square", gain=0.06, when=0}){
  const ac = getAudio();
  const t0 = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0+dur+0.02);
}
function sfx(boostType, laneIdx){
  const base = 520 + laneIdx*25;
  if(boostType === "BOOST"){
    beep({freq: base, dur:0.06, when:0});
    beep({freq: base*1.25, dur:0.06, when:0.07});
  } else if(boostType === "BURST"){
    beep({freq: base*1.5, dur:0.05, when:0});
    beep({freq: base*1.9, dur:0.05, when:0.05});
    beep({freq: base*2.2, dur:0.05, when:0.10});
  } else {
    beep({freq: base*2.0, dur:0.08, when:0, gain:0.07});
    beep({freq: base*1.2, dur:0.10, when:0.09, gain:0.06});
    beep({freq: base*2.6, dur:0.06, when:0.20, gain:0.06});
  }
}

function flash(){
  el.flash.classList.add("on");
  setTimeout(()=>el.flash.classList.remove("on"), 140);
}

function buildTestGrid(){
  el.testGrid.innerHTML = "";
  for(let i=0;i<LANES;i++){
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";

    const tag = document.createElement("div");
    tag.className = "laneTag";

    const dot = document.createElement("div");
    dot.className = "laneDot";
    dot.style.background = laneColors[i];

    const name = document.createElement("div");
    name.className = "laneName";
    name.textContent = `Машина ${i+1}`;

    tag.appendChild(dot);
    tag.appendChild(name);
    head.appendChild(tag);

    const row = document.createElement("div");
    row.className = "btnRow";

    const presets = [
      {type:"BOOST", amt:1,  msg:"Лайк BOOST",  ico: likeSets[i][0]},
      {type:"BURST", amt:5,  msg:"Лайк BURST",  ico: likeSets[i][1]},
      {type:"NITRO", amt:20, msg:"Лайк NITRO",  ico: likeSets[i][2]},
    ];

    for(const p of presets){
      const b = document.createElement("button");
      b.className = "btnMini";
      b.innerHTML = `<span class="ico">${p.ico}</span><span>${p.type}</span>`;
      b.addEventListener("click", ()=> testDonate(i, p));
      row.appendChild(b);
    }

    card.appendChild(head);
    card.appendChild(row);
    el.testGrid.appendChild(card);
  }
}

function addDonor(name, amount){
  state.donors[name] = (state.donors[name]||0) + amount;
  savePersist();
  updateTopDonors();
}

function testDonate(laneIdx, preset){
  getAudio().resume?.();

  const donors = ["pluto","dima","katya","neo","vova","queen","ghost","max","tiger","luna"];
  const name = donors[Math.floor(Math.random()*donors.length)];
  const amount = preset.amt;

  state.bank += amount;
  el.bankValue.textContent = state.bank;
  addDonor(name, amount);

  const add = preset.type === "BOOST" ? 0.07 : preset.type === "BURST" ? 0.14 : 0.24;
  state.boost[laneIdx] = clamp(state.boost[laneIdx] + add, 0, 0.60);

  if(preset.type === "BURST") state.pos[laneIdx] = clamp(state.pos[laneIdx] + 0.015, 0, 1.2);
  if(preset.type === "NITRO") state.speed[laneIdx] = clamp(state.speed[laneIdx] + 0.004, 0.10, 0.16);

  addFeed(name, laneIdx, amount, preset.msg, preset.ico);
  sfx(preset.type, laneIdx);
  flash();

  if(!state.running && state.winner === null) state.running = true;
}

function nextRound(){
  state.round += 1;
  el.roundValue.textContent = fmt2(state.round);
  state.running = false;
  state.timeLeft = ROUND_SECONDS;
  state.bank = 0;
  state.pos = state.pos.map(()=>0);
  state.boost = state.boost.map(()=>0);
  state.speed = state.speed.map(()=>0.11 + Math.random()*0.03);
  state.winner = null;
  el.feed.innerHTML = "";
  el.bankValue.textContent = state.bank;
  el.timeValue.textContent = state.timeLeft;
  el.winner.hidden = true;
}

function laneFromTap(clientX, clientY){
  const rect = el.scene.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * 1080;
  const y = (clientY - rect.top) / rect.height * 1920;
  if(y < road.topY || y > road.bottomY) return null;
  const t = clamp((road.bottomY - y) / (road.bottomY - road.topY), 0, 1);
  const L = roadL(t), R = roadR(t);
  if(x < L || x > R) return null;
  const laneW = (R-L)/LANES;
  return clamp(Math.floor((x - L)/laneW), 0, LANES-1);
}

el.hit.addEventListener("pointerdown", (e)=>{
  const idx = laneFromTap(e.clientX, e.clientY);
  if(idx === null) return;
  testDonate(idx, {type:"BOOST", amt:1, msg:"Тап BOOST", ico: likeSets[idx][0]});
});
el.btnNext.addEventListener("click", nextRound);

function draw(){
  for(let i=0;i<LANES;i++){
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);

    const scale = lerp(1.05, 0.35, t);
    const rot = Math.sin((t*2.4 + i*0.6)*Math.PI) * 0.03 * (1-t);
    carNodes[i].setAttribute("transform", `translate(${x} ${y}) rotate(${rot*57.2958}) scale(${scale})`);

    const steps = 18;
    let d = "";
    for(let s=0;s<=steps;s++){
      const tt = (s/steps) * t;
      const xx = laneCenterX(i,tt);
      const yy = roadY(tt);
      d += (s===0 ? `M ${xx} ${yy}` : ` L ${xx} ${yy}`);
    }
    const intensity = clamp(state.boost[i]/0.60, 0, 1);
    trailNodes[i].setAttribute("d", d);
    trailNodes[i].setAttribute("stroke-width", lerp(22, 6, t));
    trailNodes[i].setAttribute("opacity", (0.50 + intensity*0.50).toFixed(2));
  }
}

function checkWinner(){
  if(state.winner !== null) return;
  for(let i=0;i<LANES;i++){
    if(state.pos[i] >= 1){
      state.winner = i;
      state.running = false;
      el.winnerLane.textContent = `Полоса ${i+1}`;
      el.winner.hidden = false;

      addFeed("SYSTEM", i, 0, "Финиш!", "🏁");

      state.wins[i] = (state.wins[i]||0) + 1;
      savePersist();
      renderWins();

      sfx("NITRO", i);
      setTimeout(()=>{ if(state.winner !== null) nextRound(); }, 2600);
      break;
    }
  }
}

function update(dt){
  if(!state.running || state.winner !== null) return;

  state.timeLeft -= dt;
  if(state.timeLeft <= 0){
    state.timeLeft = 0;
    state.running = false;
  }
  el.timeValue.textContent = Math.ceil(state.timeLeft);

  for(let i=0;i<LANES;i++){
    const v = state.speed[i] + state.boost[i];
    const drag = lerp(1.0, 0.65, state.pos[i]);
    state.pos[i] = clamp(state.pos[i] + v*dt*0.35*drag, 0, 1.2);

    const dec = 0.16 + state.boost[i]*0.22;
    state.boost[i] = Math.max(0, state.boost[i] - dt*dec);
  }
  checkWinner();
}

function boot(){
  buildLaneLines();
  buildFinishBand();
  initCars();
  buildTestGrid();
  loadPersist();
  renderWins();
  updateTopDonors();

  el.roundValue.textContent = fmt2(state.round);
  el.timeValue.textContent = state.timeLeft;
  el.bankValue.textContent = state.bank;

  addFeed("SYSTEM", 0, 0, "Нажми любые тест‑кнопки — гонка начнётся.", "💬");
}
boot();

let last = performance.now();
function loop(now){
  const dt = (now-last)/1000; last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
