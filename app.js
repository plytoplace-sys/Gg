// STREAM NEON SVG (XML) — no images
// - deeper scene + neon road glow
// - car looks more like a car (vector)
// - donation notifications + sound + pop text + flames/particles
// - top donors strip with clickable profile link (browser) + mini + buttons
// Note: in TikTok stream video viewers can't "click the video". For real click-through you need a web page link/QR or overlay with clickable browser.

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
  scene: document.getElementById("scene"),
  laneLines: document.getElementById("laneLines"),
  finishBand: document.getElementById("finishBand"),
  trails: document.getElementById("trails"),
  fx: document.getElementById("fx"),
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
  donors: {}, // username -> total
  donorMeta: {}, // username -> {display, colorIndex}
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
  // subtle lane uniqueness
  x += Math.sin((t*3.1 + i*0.85)*Math.PI) * 10 * (1-t);
  return x;
}

function svgEl(name){ return document.createElementNS("http://www.w3.org/2000/svg", name); }

// ===== Build lane lines + finish =====
function buildLaneLines(){
  el.laneLines.innerHTML = "";
  for(let i=1;i<LANES;i++){
    for(let s=0;s<28;s++){
      if(s%2===1) continue;
      const t0 = s/28;
      const t1 = (s+0.62)/28;
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
      seg.setAttribute("opacity", "0.85");
      el.laneLines.appendChild(seg);
    }
  }
}

function buildFinishBand(){
  el.finishBand.innerHTML = "";
  const t = 1.0;
  const L = roadL(t), R = roadR(t);
  const y = roadY(t) + 16;
  const bandH = 26;
  const squares = 24;
  const w = (R-L)/squares;
  for(let i=0;i<squares;i++){
    const r = svgEl("rect");
    r.setAttribute("x", L + i*w);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", bandH);
    r.setAttribute("rx","2");
    r.setAttribute("fill", i%2===0 ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.78)");
    el.finishBand.appendChild(r);
  }
}

// ===== Cars, trails, FX nodes =====
const carNodes = [];
const trailNodes = [];
const popNodes = [];    // {node, life, text}
const flameNodes = [];  // {node, life, laneIdx}

function initNodes(){
  el.cars.innerHTML = "";
  el.trails.innerHTML = "";
  el.fx.innerHTML = "";
  carNodes.length = 0; trailNodes.length = 0;
  popNodes.length = 0; flameNodes.length = 0;

  for(let i=0;i<LANES;i++){
    const p = svgEl("path");
    p.setAttribute("fill","none");
    p.setAttribute("stroke", laneColors[i]);
    p.setAttribute("stroke-linecap","round");
    p.setAttribute("opacity","0.82");
    el.trails.appendChild(p);
    trailNodes.push(p);

    const use = svgEl("use");
    use.setAttributeNS("http://www.w3.org/1999/xlink","href","#car3D");
    use.setAttribute("fill", laneColors[i]);
    use.setAttribute("opacity","0.96");
    el.cars.appendChild(use);
    carNodes.push(use);

    const txt = svgEl("text");
    txt.setAttribute("text-anchor","middle");
    txt.setAttribute("font-size","40");
    txt.setAttribute("font-weight","1000");
    txt.setAttribute("fill", laneColors[i]);
    txt.setAttribute("filter","url(#glowS)");
    txt.setAttribute("opacity","0");
    el.cars.appendChild(txt);
    popNodes.push({ node: txt, life: 0, text: ""});
  }
}

function spawnPop(laneIdx, text){
  const p = popNodes[laneIdx];
  if(!p) return;
  p.text = text;
  p.life = 1.0;
  p.node.textContent = text;
  p.node.setAttribute("opacity","1");
}

function spawnFlame(laneIdx, intensity){
  // flame is a blurred circle behind car
  const c = svgEl("circle");
  c.setAttribute("r", String(lerp(26, 54, intensity)));
  c.setAttribute("fill", "url(#flameG)");
  c.setAttribute("opacity", String(lerp(0.35, 0.75, intensity)));
  c.setAttribute("filter","url(#glowM)");
  el.fx.appendChild(c);
  flameNodes.push({ node: c, life: lerp(0.25, 0.55, intensity), laneIdx, intensity });
}

function spawnPixels(laneIdx, count){
  // pixel sparks (small rects)
  for(let k=0;k<count;k++){
    const r = svgEl("rect");
    r.setAttribute("width","10");
    r.setAttribute("height","10");
    r.setAttribute("rx","2");
    r.setAttribute("fill", laneColors[laneIdx]);
    r.setAttribute("opacity","0.85");
    r.setAttribute("filter","url(#glowS)");
    el.fx.appendChild(r);
    flameNodes.push({
      node: r,
      life: 0.35 + Math.random()*0.25,
      laneIdx,
      intensity: 0.35,
      vx: (Math.random()-0.5)*120,
      vy: -60 - Math.random()*120,
      rot: (Math.random()-0.5)*120
    });
  }
}

// ===== Feed =====
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

  wrap.appendChild(l1);
  wrap.appendChild(l2);
  left.appendChild(dot);
  left.appendChild(wrap);

  const right = document.createElement("div");
  right.className = "feedAmt";
  right.textContent = amount ? `+${amount}` : "WIN";

  item.appendChild(left);
  item.appendChild(right);

  el.feed.prepend(item);
  while(el.feed.children.length > 6) el.feed.removeChild(el.feed.lastChild);
}

// ===== Persistence =====
function loadPersist(){
  try{
    const w = localStorage.getItem("ddr_stream_wins");
    if(w){
      const obj = JSON.parse(w);
      if(Array.isArray(obj.wins) && obj.wins.length === LANES) state.wins = obj.wins.map(x=>Number(x)||0);
    }
    const d = localStorage.getItem("ddr_stream_donors");
    if(d){
      const obj = JSON.parse(d);
      if(obj && typeof obj === "object") state.donors = obj;
    }
    const m = localStorage.getItem("ddr_stream_meta");
    if(m){
      const obj = JSON.parse(m);
      if(obj && typeof obj === "object") state.donorMeta = obj;
    }
  }catch(e){}
}
function savePersist(){
  try{
    localStorage.setItem("ddr_stream_wins", JSON.stringify({wins: state.wins}));
    localStorage.setItem("ddr_stream_donors", JSON.stringify(state.donors));
    localStorage.setItem("ddr_stream_meta", JSON.stringify(state.donorMeta));
  }catch(e){}
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

// ===== Top donors strip =====
function initials(name){
  const s = (name||"").replace(/^@/,"").trim();
  if(!s) return "??";
  const parts = s.split(/[._\s-]+/).filter(Boolean);
  const a = parts[0]?.[0] || s[0] || "?";
  const b = parts[1]?.[0] || s[1] || "";
  return (a+b).toUpperCase();
}

function ensureDonorMeta(username){
  if(state.donorMeta[username]) return state.donorMeta[username];
  const idx = Math.floor(Math.random()*LANES);
  const meta = { display: username, colorIndex: idx };
  state.donorMeta[username] = meta;
  return meta;
}

function renderTopStrip(){
  const top = Object.entries(state.donors)
    .map(([u,sum])=>({u, sum}))
    .sort((a,b)=>b.sum-a.sum)
    .slice(0,8);

  el.stripList.innerHTML = "";
  for(const t of top){
    const meta = ensureDonorMeta(t.u);
    const color = laneColors[meta.colorIndex];

    const chip = document.createElement("div");
    chip.className = "donorChip";

    // avatar as initials (no images)
    const av = document.createElement("div");
    av.className = "avatar";
    av.style.borderColor = "rgba(255,255,255,.20)";
    av.style.boxShadow = `0 0 24px ${color}33`;
    av.style.color = "rgba(255,255,255,.92)";
    av.textContent = initials(t.u);

    const metaBox = document.createElement("div");
    metaBox.className = "donorMeta";

    const nm = document.createElement("div");
    nm.className = "donorName";
    nm.textContent = t.u;

    const sm = document.createElement("div");
    sm.className = "donorSum";
    sm.textContent = `${t.sum} coins`;

    metaBox.appendChild(nm);
    metaBox.appendChild(sm);

    const actions = document.createElement("div");
    actions.className = "donorActions";

    // mini "+" button (demo)
    const plus = document.createElement("button");
    plus.className = "miniBtn";
    plus.textContent = "+";
    plus.title = "Тест +1 в случайную полосу";
    plus.addEventListener("click", (e)=>{
      e.stopPropagation();
      donate({
        user: t.u,
        laneIdx: Math.floor(Math.random()*LANES),
        amount: 1,
        msg: "Плюсик",
        ico: "➕",
        boostType: "BOOST"
      });
    });

    // profile button - works in browser, NOT inside TikTok video
    const prof = document.createElement("a");
    prof.className = "miniBtn";
    prof.textContent = "↗";
    prof.title = "Открыть профиль (в браузере)";
    prof.target = "_blank";
    prof.rel = "noopener";
    // TikTok profile URL pattern
    prof.href = `https://www.tiktok.com/@${t.u.replace(/^@/,"")}`;

    actions.appendChild(plus);
    actions.appendChild(prof);

    chip.appendChild(av);
    chip.appendChild(metaBox);
    chip.appendChild(actions);

    el.stripList.appendChild(chip);
  }

  if(top.length === 0){
    const hint = document.createElement("div");
    hint.style.opacity = "0.8";
    hint.style.fontSize = "11px";
    hint.textContent = "Пока нет донатов — тапни по дороге (или подставь реальные события).";
    el.stripList.appendChild(hint);
  }
}

// ===== Audio (8-bit) =====
let audioCtx = null;
let audioUnlocked = false;

function getAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function unlockAudio(){
  if(audioUnlocked) return;
  try{ getAudio().resume?.(); }catch(e){}
  audioUnlocked = true;
}
document.addEventListener("pointerdown", unlockAudio, {passive:true});

function beep({freq=880, dur=0.08, type="square", gain=0.06, when=0}){
  const ac = getAudio();
  const t0 = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0+dur+0.02);
}
function sfx(boostType, laneIdx){
  const base = 520 + laneIdx*28;
  if(boostType === "BOOST"){
    beep({freq: base, dur:0.06, when:0});
    beep({freq: base*1.22, dur:0.06, when:0.07});
  } else if(boostType === "BURST"){
    beep({freq: base*1.5, dur:0.05, when:0});
    beep({freq: base*1.9, dur:0.05, when:0.05});
    beep({freq: base*2.2, dur:0.05, when:0.10});
  } else { // NITRO
    beep({freq: base*2.2, dur:0.08, when:0, gain:0.075});
    beep({freq: base*1.25, dur:0.10, when:0.09, gain:0.06});
    beep({freq: base*2.8, dur:0.06, when:0.20, gain:0.06});
  }
  // tiny "coin" tick
  beep({freq: 1800 + laneIdx*40, dur:0.03, when:0.02, gain:0.025});
}

// ===== Visual flash =====
function flash(){
  el.flash.classList.add("on");
  setTimeout(()=> el.flash.classList.remove("on"), 140);
}

// ===== Donation pipeline =====
function addDonor(user, amount){
  state.donors[user] = (state.donors[user]||0) + amount;
  ensureDonorMeta(user);
  savePersist();
  renderTopStrip();
}

function boostAdd(boostType){
  if(boostType === "BOOST") return 0.08;
  if(boostType === "BURST") return 0.16;
  return 0.26; // NITRO
}

function donate({user, laneIdx, amount, msg, ico, boostType}){
  unlockAudio();

  // counters
  state.bank += amount;
  el.bankValue.textContent = state.bank;

  addDonor(user, amount);

  // physics
  const add = boostAdd(boostType);
  state.boost[laneIdx] = clamp(state.boost[laneIdx] + add, 0, 0.70);

  if(boostType === "BURST"){
    state.pos[laneIdx] = clamp(state.pos[laneIdx] + 0.02, 0, 1.2);
  }
  if(boostType === "NITRO"){
    state.speed[laneIdx] = clamp(state.speed[laneIdx] + 0.005, 0.105, 0.17);
  }

  // visuals + sound
  addFeed({user, laneIdx, amount, msg, ico});
  spawnPop(laneIdx, `${ico} +${amount}`);
  spawnFlame(laneIdx, clamp(add/0.26, 0, 1));
  spawnPixels(laneIdx, boostType === "NITRO" ? 10 : boostType === "BURST" ? 6 : 4);
  sfx(boostType, laneIdx);
  flash();

  // start running on first donation
  if(!state.running && state.winner === null) state.running = true;
}

// Tap on road: donate to tapped lane (demo)
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

  const users = ["@pluto","@neo","@luna","@ghost","@queen","@max","@dima","@katya"];
  const u = users[Math.floor(Math.random()*users.length)];

  // random like type => boost
  const r = Math.random();
  const boostType = r < 0.60 ? "BOOST" : r < 0.88 ? "BURST" : "NITRO";
  const amount = boostType === "BOOST" ? 1 : boostType === "BURST" ? 5 : 20;
  const ico = boostType === "BOOST" ? likeIcons[laneIdx][0] : boostType === "BURST" ? likeIcons[laneIdx][1] : likeIcons[laneIdx][2];
  const msg = boostType === "BOOST" ? "Лайк" : boostType === "BURST" ? "Супер-лайк" : "Нитро-лайк";

  donate({user: u, laneIdx, amount, msg, ico, boostType});
});

// ===== Winner/round =====
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
function draw(){
  // cars + trails + pop texts
  for(let i=0;i<LANES;i++){
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);

    // perspective scale + slight skew
    const scale = lerp(1.10, 0.33, t);
    const rot = Math.sin((t*2.2 + i*0.6)*Math.PI) * 0.035 * (1-t);

    // A bit of "depth": push cars slightly inward near top
    const inward = (i - (LANES-1)/2) * lerp(0, 10, t);

    carNodes[i].setAttribute("transform", `translate(${x+inward} ${y}) rotate(${rot*57.2958}) scale(${scale})`);

    // trail
    const steps = 22;
    let d = "";
    for(let s=0;s<=steps;s++){
      const tt = (s/steps)*t;
      const xx = laneCenterX(i,tt);
      const yy = roadY(tt);
      d += (s===0 ? `M ${xx} ${yy}` : ` L ${xx} ${yy}`);
    }
    const intensity = clamp(state.boost[i]/0.70, 0, 1);
    trailNodes[i].setAttribute("d", d);
    trailNodes[i].setAttribute("stroke-width", lerp(22, 5, t));
    trailNodes[i].setAttribute("opacity", (0.50 + intensity*0.50).toFixed(2));

    // pop text
    const p = popNodes[i];
    if(p.life > 0){
      const dy = (1 - p.life) * 90;
      const o = Math.max(0, Math.min(1, p.life));
      p.node.setAttribute("transform", `translate(${x} ${y-120-dy}) scale(${Math.max(0.56, scale)})`);
      p.node.setAttribute("opacity", String(o));
    } else {
      p.node.setAttribute("opacity","0");
    }
  }

  // flames/pixels
  for(let k=flameNodes.length-1;k>=0;k--){
    const f = flameNodes[k];
    f.life -= dt_global;
    if(f.life <= 0){
      f.node.remove();
      flameNodes.splice(k,1);
      continue;
    }
    const i = f.laneIdx;
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);

    const scale = lerp(1.10, 0.33, t);
    const back = 76 * scale; // behind car
    const fade = Math.max(0, Math.min(1, f.life / 0.55));

    if(f.node.tagName.toLowerCase() === "circle"){
      f.node.setAttribute("cx", String(x));
      f.node.setAttribute("cy", String(y+back));
      f.node.setAttribute("opacity", String(0.20 + 0.70*fade));
    } else {
      // pixel rect
      const vx = f.vx || 0;
      const vy = f.vy || 0;
      const age = (0.65 - f.life);
      const px = x + vx*age*0.9;
      const py = y + back + vy*age*0.9;
      f.node.setAttribute("x", String(px));
      f.node.setAttribute("y", String(py));
      f.node.setAttribute("opacity", String(0.75*fade));
      const r = (f.rot||0) * age;
      f.node.setAttribute("transform", `rotate(${r} ${px} ${py}) scale(${Math.max(0.5, scale)})`);
    }
  }
}

let dt_global = 0;

function checkWinner(){
  if(state.winner !== null) return;
  for(let i=0;i<LANES;i++){
    if(state.pos[i] >= 1){
      state.winner = i;
      state.running = false;
      el.winnerLane.textContent = `Полоса ${i+1}`;
      el.winner.hidden = false;

      addFeed({user:"SYSTEM", laneIdx:i, amount:0, msg:"Финиш!", ico:"🏁"});
      state.wins[i] = (state.wins[i]||0) + 1;
      savePersist();
      renderWins();

      // victory jingle
      sfx("NITRO", i);

      setTimeout(()=>{ if(state.winner !== null) nextRound(); }, 2600);
      break;
    }
  }
}

function update(dt){
  dt_global = dt;
  if(!state.running || state.winner !== null) {
    // decay pop texts even on pause
    for(let i=0;i<LANES;i++){
      const p = popNodes[i];
      if(p.life > 0) p.life = Math.max(0, p.life - dt*0.9);
    }
    return;
  }

  state.timeLeft -= dt;
  if(state.timeLeft <= 0){
    state.timeLeft = 0;
    state.running = false;
  }
  el.timeValue.textContent = Math.ceil(state.timeLeft);

  // decay pop texts
  for(let i=0;i<LANES;i++){
    const p = popNodes[i];
    if(p.life > 0) p.life = Math.max(0, p.life - dt);
  }

  for(let i=0;i<LANES;i++){
    const v = state.speed[i] + state.boost[i];
    const drag = lerp(1.0, 0.62, state.pos[i]); // dramatic near finish
    state.pos[i] = clamp(state.pos[i] + v*dt*0.36*drag, 0, 1.2);

    // boost decay
    const dec = 0.15 + state.boost[i]*0.25;
    state.boost[i] = Math.max(0, state.boost[i] - dt*dec);
  }

  checkWinner();
}

// ===== Boot =====
function boot(){
  buildLaneLines();
  buildFinishBand();
  initNodes();
  loadPersist();
  renderWins();
  renderTopStrip();

  el.roundValue.textContent = fmt2(state.round);
  el.timeValue.textContent = state.timeLeft;
  el.bankValue.textContent = state.bank;

  addFeed({user:"SYSTEM", laneIdx:0, amount:0, msg:"Тап по дороге = демо доната. Подключишь реальные события — будет огонь.", ico:"💬"});
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
