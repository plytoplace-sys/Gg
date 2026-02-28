// Cars from FILES + correct orientation (no sideways)
// Each car svg is drawn nose-up. We only translate + scale (optional tiny sway).

const LANES = 6;
const ROUND_SECONDS = 60;
const laneColors = ["#ff3b3b","#2f7bff","#ffcc33","#36ff7a","#8b5bff","#ff4bd1"];
const likeIcons = [
  ["❤️","🔥","⚡"],
  ["💙","🌊","🌀"],
  ["💛","✨","⭐"],
  ["💚","🍀","🌿"],
  ["💜","🔮","🦄"],
  ["🩷","🌸","💫"]
];

const road = { topY: 260, bottomY: 1680, topL: 400, topR: 680, botL: 80, botR: 1000 };

const el = {
  stage: document.getElementById("stage"),
  scene: document.getElementById("scene"),
  laneLines: document.getElementById("laneLines"),
  finishBand: document.getElementById("finishBand"),
  trails: document.getElementById("trails"),
  cars: document.getElementById("cars"),
  flash: document.getElementById("flash"),
  hit: document.getElementById("hit"),
  stripList: document.getElementById("stripList"),
  bankValue: document.getElementById("bankValue"),
  roundValue: document.getElementById("roundValue"),
  timeValue: document.getElementById("timeValue"),
  feed: document.getElementById("feed"),
  winsTotal: document.getElementById("winsTotal"),
  winsMini: document.getElementById("winsMini"),
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
  speed: Array.from({length: LANES}, ()=>0.112 + Math.random()*0.03),
  boost: Array.from({length: LANES}, ()=>0),
  winner: null,
  wins: Array.from({length: LANES}, ()=>0),
  donors: {},
  donorMeta: {},
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
  // subtle curvature but NOT rotation
  x += Math.sin((t*3.0 + i*0.85)*Math.PI) * 10 * (1-t);
  return x;
}
function svgEl(name){ return document.createElementNS("http://www.w3.org/2000/svg", name); }

// ===== lane lines + finish =====
function buildLaneLines(){
  el.laneLines.innerHTML = "";
  for(let i=1;i<LANES;i++){
    for(let s=0;s<30;s++){
      if(s%2===1) continue;
      const t0 = s/30;
      const t1 = (s+0.64)/30;
      const y0 = lerp(road.bottomY, road.topY, t0);
      const y1 = lerp(road.bottomY, road.topY, t1);
      const tx0 = (road.bottomY - y0)/(road.bottomY-road.topY);
      const tx1 = (road.bottomY - y1)/(road.bottomY-road.topY);
      const x0 = lerp(roadL(tx0), roadR(tx0), i/LANES);
      const x1 = lerp(roadL(tx1), roadR(tx1), i/LANES);
      const seg = svgEl("line");
      seg.setAttribute("x1", x0); seg.setAttribute("y1", y0);
      seg.setAttribute("x2", x1); seg.setAttribute("y2", y1);
      seg.setAttribute("stroke-width", lerp(10,3,tx0));
      seg.setAttribute("opacity", "0.92");
      el.laneLines.appendChild(seg);
    }
  }
}
function buildFinishBand(){
  el.finishBand.innerHTML = "";
  const t = 1.0;
  const L = roadL(t), R = roadR(t);
  const y = roadY(t) + 14;
  const bandH = 28;
  const squares = 24;
  const w = (R-L)/squares;
  for(let i=0;i<squares;i++){
    const r = svgEl("rect");
    r.setAttribute("x", L + i*w);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", bandH);
    r.setAttribute("rx","2");
    r.setAttribute("fill", i%2===0 ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.78)");
    el.finishBand.appendChild(r);
  }
}

// ===== Load SVG car assets and inject =====
async function loadSvgGroup(url){
  const res = await fetch(url, {cache:"no-cache"});
  const txt = await res.text();
  const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
  const svg = doc.documentElement;

  const g = svgEl("g");
  // import children (skip defs? keep all)
  [...svg.childNodes].forEach(n=>{
    g.appendChild(document.importNode(n, true));
  });
  // normalize: center at (0,0) already by viewBox
  return g;
}

const carNodes = [];
const trailNodes = [];
const popNodes = [];

async function initCars(){
  el.cars.innerHTML = "";
  el.trails.innerHTML = "";
  carNodes.length = 0; trailNodes.length = 0; popNodes.length = 0;

  for(let i=0;i<LANES;i++){
    const p = svgEl("path");
    p.setAttribute("fill","none");
    p.setAttribute("stroke", laneColors[i]);
    p.setAttribute("stroke-linecap","round");
    p.setAttribute("opacity","0.88");
    el.trails.appendChild(p);
    trailNodes.push(p);

    const g = await loadSvgGroup(`assets/cars/lane${i+1}.svg`);
    // give additional glow filter
    g.setAttribute("filter","url(#glowS)");
    el.cars.appendChild(g);
    carNodes.push(g);

    const txt = svgEl("text");
    txt.setAttribute("text-anchor","middle");
    txt.setAttribute("font-size","44");
    txt.setAttribute("font-weight","1000");
    txt.setAttribute("fill", laneColors[i]);
    txt.setAttribute("filter","url(#glowS)");
    txt.setAttribute("opacity","0");
    el.cars.appendChild(txt);
    popNodes.push({node: txt, life:0});
  }
}

function spawnPop(laneIdx, text){
  const p = popNodes[laneIdx];
  p.life = 1.05;
  p.node.textContent = text;
  p.node.setAttribute("opacity","1");
}

// ===== UI feed + top strip (keep minimal) =====
function addFeed({user, laneIdx, amount, msg, ico}){
  const item = document.createElement("div");
  item.className = "feedItem";
  const left = document.createElement("div");
  left.className = "feedLeft";
  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = laneColors[laneIdx];
  const wrap = document.createElement("div");
  wrap.className = "msgWrap";
  const l1 = document.createElement("div");
  l1.className = "feedLine1";
  l1.textContent = `${ico} ${user} → Полоса ${laneIdx+1}`;
  const l2 = document.createElement("div");
  l2.className = "feedLine2";
  l2.textContent = msg || "Донат!";
  wrap.appendChild(l1); wrap.appendChild(l2);
  left.appendChild(dot); left.appendChild(wrap);
  const right = document.createElement("div");
  right.className = "feedAmt";
  right.textContent = amount ? `+${amount}` : "WIN";
  item.appendChild(left); item.appendChild(right);
  el.feed.prepend(item);
  while(el.feed.children.length > 6) el.feed.removeChild(el.feed.lastChild);
}

function initials(name){
  const s = (name||"").replace(/^@/,"").trim();
  if(!s) return "??";
  return (s[0] + (s[1]||"")).toUpperCase();
}
function renderTopStrip(){
  const top = Object.entries(state.donors)
    .map(([u,sum])=>({u,sum}))
    .sort((a,b)=>b.sum-a.sum)
    .slice(0,6);
  el.stripList.innerHTML = "";
  for(const t of top){
    const chip = document.createElement("div");
    chip.className = "donorChip";
    const av = document.createElement("div");
    av.className = "avatar";
    av.textContent = initials(t.u);
    const meta = document.createElement("div");
    meta.className = "donorMeta";
    const nm = document.createElement("div");
    nm.className = "donorName";
    nm.textContent = t.u;
    const sm = document.createElement("div");
    sm.className = "donorSum";
    sm.textContent = `${t.sum} coins`;
    meta.appendChild(nm); meta.appendChild(sm);
    chip.appendChild(av); chip.appendChild(meta);
    el.stripList.appendChild(chip);
  }
}

// ===== Audio tiny =====
let audioCtx = null;
function getAudio(){ return audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); }
function beep(freq, dur=0.07){
  const ac = getAudio();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime+dur+0.02);
}

// ===== Donate (demo tap) =====
function donate({user,laneIdx,amount,msg,ico}){
  state.bank += amount;
  el.bankValue.textContent = state.bank;
  state.donors[user] = (state.donors[user]||0)+amount;
  renderTopStrip();

  state.boost[laneIdx] = clamp(state.boost[laneIdx] + (amount>=20?0.30:amount>=5?0.18:0.10), 0, 0.86);
  addFeed({user,laneIdx,amount,msg,ico});
  spawnPop(laneIdx, `${ico} +${amount}`);
  beep(720 + laneIdx*40, 0.06);
  if(!state.running && state.winner===null) state.running = true;
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
  const laneIdx = laneFromTap(e.clientX, e.clientY);
  if(laneIdx === null) return;
  const users = ["@pluto","@neo","@luna","@ghost","@queen","@max"];
  const u = users[Math.floor(Math.random()*users.length)];
  const r = Math.random();
  const amount = r<0.60?1:r<0.88?5:20;
  const ico = amount===1?likeIcons[laneIdx][0]:amount===5?likeIcons[laneIdx][1]:likeIcons[laneIdx][2];
  const msg = amount===1?"Лайк":amount===5?"Супер-лайк":"НИТРО";
  donate({user:u,laneIdx,amount,msg,ico});
});

// ===== Winner / rounds =====
function nextRound(){
  state.round += 1;
  el.roundValue.textContent = fmt2(state.round);
  state.running = false;
  state.timeLeft = ROUND_SECONDS;
  state.bank = 0;
  el.bankValue.textContent = state.bank;
  el.timeValue.textContent = state.timeLeft;
  state.pos = state.pos.map(()=>0);
  state.boost = state.boost.map(()=>0);
  state.speed = state.speed.map(()=>0.112 + Math.random()*0.03);
  state.winner = null;
  el.feed.innerHTML = "";
  el.winner.hidden = true;
}
el.btnNext.addEventListener("click", nextRound);

// ===== Animation =====
let last = performance.now();
function update(dt){
  // pop decay
  for(const p of popNodes){
    if(p.life>0) p.life = Math.max(0, p.life-dt*(state.running?1:0.8));
  }

  if(!state.running || state.winner!==null) return;

  state.timeLeft -= dt;
  if(state.timeLeft<=0){ state.timeLeft=0; state.running=false; }
  el.timeValue.textContent = Math.ceil(state.timeLeft);

  for(let i=0;i<LANES;i++){
    const v = state.speed[i] + state.boost[i];
    const drag = lerp(1.0, 0.60, state.pos[i]);
    state.pos[i] = clamp(state.pos[i] + v*dt*0.36*drag, 0, 1.2);
    state.boost[i] = Math.max(0, state.boost[i] - dt*(0.13 + state.boost[i]*0.28));
  }

  for(let i=0;i<LANES;i++){
    if(state.pos[i]>=1){
      state.winner = i;
      state.running = false;
      el.winnerLane.textContent = `Полоса ${i+1}`;
      el.winner.hidden = false;
      state.wins[i] = (state.wins[i]||0)+1;
      renderWins();
      addFeed({user:"SYSTEM", laneIdx:i, amount:0, msg:"Финиш!", ico:"🏁"});
      setTimeout(()=>{ if(state.winner!==null) nextRound(); }, 2400);
      break;
    }
  }
}

function draw(){
  for(let i=0;i<LANES;i++){
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);
    const scale = lerp(1.05, 0.26, t);
    const inward = (i - (LANES-1)/2) * lerp(0, 12, t);

    // IMPORTANT: no rotate => never "sideways"
    carNodes[i].setAttribute("transform", `translate(${x+inward} ${y}) scale(${scale})`);

    // trails
    const steps = 24;
    let d = "";
    for(let s=0;s<=steps;s++){
      const tt = (s/steps)*t;
      d += (s===0?`M ${laneCenterX(i,tt)} ${roadY(tt)}`:` L ${laneCenterX(i,tt)} ${roadY(tt)}`);
    }
    const intensity = clamp(state.boost[i]/0.86,0,1);
    trailNodes[i].setAttribute("d", d);
    trailNodes[i].setAttribute("stroke-width", lerp(24, 5, t));
    trailNodes[i].setAttribute("opacity", (0.45 + 0.55*intensity).toFixed(2));

    // pop text
    const p = popNodes[i];
    if(p.life>0){
      const dy = (1-p.life)*100;
      const o = Math.max(0, Math.min(1, p.life));
      p.node.setAttribute("transform", `translate(${x} ${y-160-dy}) scale(${Math.max(0.55, scale)})`);
      p.node.setAttribute("opacity", String(o));
    } else {
      p.node.setAttribute("opacity","0");
    }
  }
}

function renderWins(){
  let total = 0;
  el.winsMini.innerHTML = "";
  for(let i=0;i<LANES;i++){
    total += state.wins[i];
    const p = document.createElement("div");
    p.className = "wmini";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = laneColors[i];
    dot.style.width = "8px"; dot.style.height="8px";
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `L${i+1}`;
    const c = document.createElement("span");
    c.className = "c";
    c.textContent = state.wins[i];
    p.appendChild(dot); p.appendChild(n); p.appendChild(c);
    el.winsMini.appendChild(p);
  }
  el.winsTotal.textContent = total;
}

// Boot
function buildFinishBand(){
  const g = document.getElementById("finishBand");
  g.innerHTML = "";
  const t = 1.0;
  const L = roadL(t), R = roadR(t);
  const y = roadY(t) + 14;
  const bandH = 28;
  const squares = 24;
  const w = (R-L)/squares;
  for(let i=0;i<squares;i++){
    const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x", L + i*w);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", bandH);
    r.setAttribute("rx","2");
    r.setAttribute("fill", i%2===0 ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.78)");
    g.appendChild(r);
  }
}

async function boot(){
  buildLaneLines();
  buildFinishBand();
  await initCars();
  renderWins();
  renderTopStrip();
  el.roundValue.textContent = fmt2(state.round);
  el.timeValue.textContent = state.timeLeft;
  el.bankValue.textContent = state.bank;
  addFeed({user:"SYSTEM", laneIdx:0, amount:0, msg:"Машины грузятся из файлов assets/cars/lane*.svg и НЕ поворачиваются боком.", ico:"✅"});
  let now = performance.now();
  function loop(t){
    const dt = (t-now)/1000; now=t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
boot();
