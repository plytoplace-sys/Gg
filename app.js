// STREAM ULTRA (SVG/XML) — OBS Browser Source friendly
// Ultra car template with layered materials + headlights + underglow
// Animated city windows + road streaks + nitro wave + camera shake

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
  fx: document.getElementById("fx"),
  cars: document.getElementById("cars"),
  flash: document.getElementById("flash"),
  hit: document.getElementById("hit"),
  streaks: document.getElementById("streaks"),
  winBack: document.getElementById("winBack"),
  winFront: document.getElementById("winFront"),
  centerGlow: document.getElementById("centerGlow"),

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
  nitroWave: 0, // 0..1
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
  x += Math.sin((t*3.1 + i*0.85)*Math.PI) * 10 * (1-t);
  return x;
}

function svgEl(name){ return document.createElementNS("http://www.w3.org/2000/svg", name); }

// ===== Windows (animated) =====
function buildWindows(){
  // back windows
  el.winBack.innerHTML = "";
  el.winFront.innerHTML = "";

  function addGrid(group, x0, y0, cols, rows, dx, dy, color){
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if(Math.random() < 0.25) continue;
        const rect = svgEl("rect");
        rect.setAttribute("x", x0 + c*dx);
        rect.setAttribute("y", y0 + r*dy);
        rect.setAttribute("width", 10);
        rect.setAttribute("height", 10);
        rect.setAttribute("rx","2");
        rect.setAttribute("fill", color);
        rect.setAttribute("opacity", (0.10 + Math.random()*0.22).toFixed(2));
        group.appendChild(rect);
        // flicker animation
        const an = svgEl("animate");
        an.setAttribute("attributeName","opacity");
        const a = 0.06 + Math.random()*0.10;
        const b = 0.18 + Math.random()*0.28;
        an.setAttribute("values", `${a};${b};${a}`);
        an.setAttribute("dur", `${2.0 + Math.random()*3.5}s`);
        an.setAttribute("repeatCount","indefinite");
        rect.appendChild(an);
      }
    }
  }

  addGrid(el.winBack, 70, 380, 10, 9, 18, 22, "#7aa2ff");
  addGrid(el.winBack, 280, 430, 11, 8, 18, 22, "#ff4bd1");
  addGrid(el.winBack, 520, 320, 10, 10, 18, 22, "#36ff7a");
  addGrid(el.winBack, 750, 400, 12, 9, 18, 22, "#ffcc33");

  addGrid(el.winFront, 40, 720, 12, 10, 20, 24, "#7aa2ff");
  addGrid(el.winFront, 330, 680, 12, 11, 20, 24, "#ff4bd1");
  addGrid(el.winFront, 650, 770, 11, 9, 20, 24, "#36ff7a");
  addGrid(el.winFront, 920, 720, 7, 10, 20, 24, "#ffcc33");
}

// ===== Build lane lines + finish =====
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

// ===== Road streaks =====
const streakNodes = [];
function buildStreaks(){
  el.streaks.innerHTML = "";
  streakNodes.length = 0;
  for(let i=0;i<14;i++){
    const p = svgEl("path");
    p.setAttribute("fill","none");
    p.setAttribute("stroke","url(#streak)");
    p.setAttribute("stroke-linecap","round");
    p.setAttribute("stroke-width", String(lerp(18, 8, i/14)));
    p.setAttribute("opacity", (0.10 + Math.random()*0.22).toFixed(2));
    el.streaks.appendChild(p);
    streakNodes.push({node:p, phase: Math.random(), lane: Math.floor(Math.random()*LANES)});
  }
}

// ===== Nodes =====
const carNodes = [];
const trailNodes = [];
const popNodes = [];
const fxNodes = []; // flames + pixels
let carTemplate = null;

function initNodes(){
  el.cars.innerHTML = "";
  el.trails.innerHTML = "";
  el.fx.innerHTML = "";
  carNodes.length = 0; trailNodes.length = 0; popNodes.length = 0; fxNodes.length = 0;

  carTemplate = document.getElementById("carTemplateUltra");

  for(let i=0;i<LANES;i++){
    const p = svgEl("path");
    p.setAttribute("fill","none");
    p.setAttribute("stroke", laneColors[i]);
    p.setAttribute("stroke-linecap","round");
    p.setAttribute("opacity","0.88");
    el.trails.appendChild(p);
    trailNodes.push(p);

    // clone car
    const g = carTemplate.cloneNode(true);
    g.removeAttribute("id");

    // recolor body surfaces & underglow & headlights
    g.querySelectorAll(".carBody,.carSplitter,.carWing,.carGrill").forEach(n=>{
      n.setAttribute("fill", laneColors[i]);
    });
    const ug = g.querySelector(".carUnderglow");
    if(ug) ug.setAttribute("fill", laneColors[i]);

    g.querySelectorAll(".carHeadL,.carHeadR").forEach(n=>{
      n.setAttribute("fill", "#ffffff");
      n.setAttribute("opacity", "0.22");
    });

    // slight per-lane deco stripe
    const stripe = svgEl("path");
    stripe.setAttribute("d", "M-72 44 Q0 26 72 44");
    stripe.setAttribute("fill","none");
    stripe.setAttribute("stroke","#fff");
    stripe.setAttribute("stroke-opacity","0.10");
    stripe.setAttribute("stroke-width","6");
    stripe.setAttribute("filter","url(#glowXS)");
    g.appendChild(stripe);

    el.cars.appendChild(g);
    carNodes.push(g);

    // pop text
    const txt = svgEl("text");
    txt.setAttribute("text-anchor","middle");
    txt.setAttribute("font-size","44");
    txt.setAttribute("font-weight","1000");
    txt.setAttribute("fill", laneColors[i]);
    txt.setAttribute("filter","url(#glowS)");
    txt.setAttribute("opacity","0");
    el.cars.appendChild(txt);
    popNodes.push({node: txt, life:0, text:""});
  }
}

function spawnPop(laneIdx, text){
  const p = popNodes[laneIdx];
  if(!p) return;
  p.text = text;
  p.life = 1.10;
  p.node.textContent = text;
  p.node.setAttribute("opacity","1");
}

function spawnFlame(laneIdx, intensity){
  const c = svgEl("circle");
  c.setAttribute("r", String(lerp(30, 72, intensity)));
  c.setAttribute("fill", "url(#flameCore)");
  c.setAttribute("opacity", String(lerp(0.45, 0.95, intensity)));
  c.setAttribute("filter","url(#glowM)");
  el.fx.appendChild(c);
  fxNodes.push({node:c, life: lerp(0.25,0.65,intensity), laneIdx, kind:"flame"});
}

function spawnPixels(laneIdx, count){
  for(let k=0;k<count;k++){
    const r = svgEl("rect");
    r.setAttribute("width","10");
    r.setAttribute("height","10");
    r.setAttribute("rx","2");
    r.setAttribute("fill", laneColors[laneIdx]);
    r.setAttribute("opacity","0.92");
    r.setAttribute("filter","url(#glowS)");
    el.fx.appendChild(r);
    fxNodes.push({
      node:r,
      life: 0.38 + Math.random()*0.34,
      laneIdx,
      kind:"px",
      vx:(Math.random()-0.5)*220,
      vy:-90 - Math.random()*210,
      rot:(Math.random()-0.5)*220
    });
  }
}

function spawnWave(){
  state.nitroWave = 1.0;
}

// ===== UI feed =====
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

// ===== Persistence =====
function loadPersist(){
  try{
    const w = localStorage.getItem("ddr_ultra_wins");
    if(w){
      const obj = JSON.parse(w);
      if(Array.isArray(obj.wins) && obj.wins.length === LANES) state.wins = obj.wins.map(x=>Number(x)||0);
    }
    const d = localStorage.getItem("ddr_ultra_donors");
    if(d){
      const obj = JSON.parse(d);
      if(obj && typeof obj === "object") state.donors = obj;
    }
    const m = localStorage.getItem("ddr_ultra_meta");
    if(m){
      const obj = JSON.parse(m);
      if(obj && typeof obj === "object") state.donorMeta = obj;
    }
  }catch(e){}
}
function savePersist(){
  try{
    localStorage.setItem("ddr_ultra_wins", JSON.stringify({wins: state.wins}));
    localStorage.setItem("ddr_ultra_donors", JSON.stringify(state.donors));
    localStorage.setItem("ddr_ultra_meta", JSON.stringify(state.donorMeta));
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

// ===== Top donors =====
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
  const meta = { colorIndex: idx };
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

    const av = document.createElement("div");
    av.className = "avatar";
    av.style.boxShadow = `0 0 44px ${color}66`;
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

    // Mini "+" for demo
    const plus = document.createElement("button");
    plus.className = "miniBtn";
    plus.textContent = "+";
    plus.title = "Демо +1";
    plus.addEventListener("click", (e)=>{
      e.stopPropagation();
      donate({user:t.u, laneIdx:Math.floor(Math.random()*LANES), amount:1, msg:"Плюсик", ico:"➕", boostType:"BOOST"});
    });

    // Profile button (browser). In TikTok video viewers can't click overlay.
    const prof = document.createElement("a");
    prof.className = "miniBtn";
    prof.textContent = "↗";
    prof.title = "Открыть профиль (браузер)";
    prof.target = "_blank";
    prof.rel = "noopener";
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
    hint.style.opacity = "0.88";
    hint.style.fontSize = "11px";
    hint.textContent = "Пока нет донатов — тапни по дороге (демо).";
    el.stripList.appendChild(hint);
  }
}

// ===== Audio =====
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
    beep({freq: base*1.55, dur:0.05, when:0});
    beep({freq: base*1.95, dur:0.05, when:0.05});
    beep({freq: base*2.25, dur:0.05, when:0.10});
  } else {
    beep({freq: base*2.25, dur:0.08, when:0, gain:0.08});
    beep({freq: base*1.30, dur:0.10, when:0.09, gain:0.06});
    beep({freq: base*2.95, dur:0.06, when:0.20, gain:0.06});
  }
  beep({freq: 1900 + laneIdx*42, dur:0.03, when:0.02, gain:0.03});
}

// ===== Visual flash + shake =====
function flash(){
  el.flash.classList.add("on");
  setTimeout(()=> el.flash.classList.remove("on"), 110);
}
function shake(){
  el.stage.classList.remove("shake");
  // reflow
  void el.stage.offsetWidth;
  el.stage.classList.add("shake");
}

// ===== Donation =====
function addDonor(user, amount){
  state.donors[user] = (state.donors[user]||0) + amount;
  ensureDonorMeta(user);
  savePersist();
  renderTopStrip();
}
function boostAdd(boostType){
  if(boostType === "BOOST") return 0.10;
  if(boostType === "BURST") return 0.20;
  return 0.32;
}
function donate({user, laneIdx, amount, msg, ico, boostType}){
  unlockAudio();

  state.bank += amount;
  el.bankValue.textContent = state.bank;

  addDonor(user, amount);

  const add = boostAdd(boostType);
  state.boost[laneIdx] = clamp(state.boost[laneIdx] + add, 0, 0.86);

  if(boostType === "BURST") state.pos[laneIdx] = clamp(state.pos[laneIdx] + 0.022, 0, 1.2);
  if(boostType === "NITRO") state.speed[laneIdx] = clamp(state.speed[laneIdx] + 0.007, 0.105, 0.19);

  addFeed({user, laneIdx, amount, msg, ico});
  spawnPop(laneIdx, `${ico} +${amount}`);
  spawnFlame(laneIdx, clamp(add/0.32, 0, 1));
  spawnPixels(laneIdx, boostType === "NITRO" ? 14 : boostType === "BURST" ? 9 : 5);
  sfx(boostType, laneIdx);
  flash();

  if(boostType === "NITRO"){
    spawnWave();
    shake();
  }

  if(!state.running && state.winner === null) state.running = true;
}

// Tap on road => demo donate to tapped lane
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

  const users = ["@pluto","@neo","@luna","@ghost","@queen","@max","@dima","@katya","@storm","@viper"];
  const u = users[Math.floor(Math.random()*users.length)];
  const r = Math.random();
  const boostType = r < 0.60 ? "BOOST" : r < 0.88 ? "BURST" : "NITRO";
  const amount = boostType === "BOOST" ? 1 : boostType === "BURST" ? 5 : 20;
  const ico = boostType === "BOOST" ? likeIcons[laneIdx][0] : boostType === "BURST" ? likeIcons[laneIdx][1] : likeIcons[laneIdx][2];
  const msg = boostType === "BOOST" ? "Лайк" : boostType === "BURST" ? "Супер-лайк" : "НИТРО";
  donate({user:u, laneIdx, amount, msg, ico, boostType});
});

// ===== Round =====
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
  state.nitroWave = 0;

  el.feed.innerHTML = "";
  el.winner.hidden = true;
}
el.btnNext.addEventListener("click", nextRound);

// ===== Animation =====
let dt_global = 0;

function draw(){
  // center glow wave (nitro)
  if(state.nitroWave > 0){
    const o = Math.max(0, Math.min(1, state.nitroWave));
    el.centerGlow.setAttribute("opacity", String(0.12 + o*0.22));
  } else {
    el.centerGlow.setAttribute("opacity", "0.12");
  }

  // cars + trails + pop
  for(let i=0;i<LANES;i++){
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);

    const scale = lerp(1.15, 0.28, t);
    const rot = Math.sin((t*2.2 + i*0.6)*Math.PI) * 0.045 * (1-t);
    const inward = (i - (LANES-1)/2) * lerp(0, 14, t);

    // apply underglow intensity
    const intensity = clamp(state.boost[i]/0.86, 0, 1);
    const ug = carNodes[i].querySelector(".carUnderglow");
    if(ug){
      ug.setAttribute("opacity", String(0.18 + 0.34*intensity));
      ug.setAttribute("filter", intensity > 0.5 ? "url(#glowL)" : "url(#glowM)");
    }

    // headlights pulse a bit
    carNodes[i].querySelectorAll(".carHeadL,.carHeadR").forEach(n=>{
      n.setAttribute("opacity", String(0.12 + 0.18*intensity));
    });

    carNodes[i].setAttribute("transform", `translate(${x+inward} ${y}) rotate(${rot*57.2958}) scale(${scale})`);

    // trail
    const steps = 26;
    let d = "";
    for(let s=0;s<=steps;s++){
      const tt = (s/steps)*t;
      const xx = laneCenterX(i,tt);
      const yy = roadY(tt);
      d += (s===0 ? `M ${xx} ${yy}` : ` L ${xx} ${yy}`);
    }
    trailNodes[i].setAttribute("d", d);
    trailNodes[i].setAttribute("stroke-width", lerp(26, 5, t));
    trailNodes[i].setAttribute("opacity", (0.48 + intensity*0.52).toFixed(2));

    // pop text
    const p = popNodes[i];
    if(p.life > 0){
      const dy = (1 - p.life) * 110;
      const o = Math.max(0, Math.min(1, p.life));
      p.node.setAttribute("transform", `translate(${x} ${y-132-dy}) scale(${Math.max(0.60, scale)})`);
      p.node.setAttribute("opacity", String(o));
    } else {
      p.node.setAttribute("opacity","0");
    }
  }

  // road streaks motion
  for(const s of streakNodes){
    s.phase = (s.phase + dt_global*(0.18 + Math.random()*0.02)) % 1;
    const t = s.phase;
    const lane = s.lane;
    const y0 = roadY(t);
    const y1 = roadY(Math.min(1, t+0.12));
    const x0 = laneCenterX(lane, t);
    const x1 = laneCenterX(lane, Math.min(1, t+0.12));
    s.node.setAttribute("d", `M ${x0} ${y0} L ${x1} ${y1}`);
    s.node.setAttribute("stroke-width", String(lerp(22, 6, t)));
    s.node.setAttribute("opacity", (0.08 + (1-t)*0.25).toFixed(2));
  }

  // fx
  for(let k=fxNodes.length-1;k>=0;k--){
    const f = fxNodes[k];
    f.life -= dt_global;
    if(f.life <= 0){
      f.node.remove();
      fxNodes.splice(k,1);
      continue;
    }
    const i = f.laneIdx;
    const t = state.pos[i];
    const x = laneCenterX(i,t);
    const y = roadY(t);
    const scale = lerp(1.15, 0.28, t);
    const back = 92 * scale;
    const fade = Math.max(0, Math.min(1, f.life / 0.65));

    if(f.kind === "flame"){
      f.node.setAttribute("cx", String(x));
      f.node.setAttribute("cy", String(y+back));
      f.node.setAttribute("opacity", String(0.25 + 0.75*fade));
    }else{
      const age = (0.85 - f.life);
      const px = x + (f.vx||0)*age*0.9;
      const py = y + back + (f.vy||0)*age*0.9;
      f.node.setAttribute("x", String(px));
      f.node.setAttribute("y", String(py));
      f.node.setAttribute("opacity", String(0.85*fade));
      const r = (f.rot||0) * age;
      f.node.setAttribute("transform", `rotate(${r} ${px} ${py}) scale(${Math.max(0.5, scale)})`);
    }
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

      addFeed({user:"SYSTEM", laneIdx:i, amount:0, msg:"Финиш!", ico:"🏁"});
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
  dt_global = dt;

  // pop decay always
  for(let i=0;i<LANES;i++){
    const p = popNodes[i];
    if(p.life > 0) p.life = Math.max(0, p.life - dt*(state.running?1:0.8));
  }

  // nitro wave decay
  if(state.nitroWave > 0) state.nitroWave = Math.max(0, state.nitroWave - dt*1.6);

  if(!state.running || state.winner !== null) return;

  state.timeLeft -= dt;
  if(state.timeLeft <= 0){
    state.timeLeft = 0;
    state.running = false;
  }
  el.timeValue.textContent = Math.ceil(state.timeLeft);

  for(let i=0;i<LANES;i++){
    const v = state.speed[i] + state.boost[i];
    const drag = lerp(1.0, 0.58, state.pos[i]);
    state.pos[i] = clamp(state.pos[i] + v*dt*0.37*drag, 0, 1.2);

    const dec = 0.13 + state.boost[i]*0.28;
    state.boost[i] = Math.max(0, state.boost[i] - dt*dec);
  }

  checkWinner();
}

// ===== Boot =====
function boot(){
  buildWindows();
  buildLaneLines();
  buildFinishBand();
  buildStreaks();
  initNodes();

  loadPersist();
  renderWins();
  renderTopStrip();

  el.roundValue.textContent = fmt2(state.round);
  el.timeValue.textContent = state.timeLeft;
  el.bankValue.textContent = state.bank;

  addFeed({user:"SYSTEM", laneIdx:0, amount:0, msg:"Тап по дороге = демо доната. В OBS Browser Source всё будет ультра-неоново.", ico:"💬"});
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
