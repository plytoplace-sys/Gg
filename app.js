const LANES = 6;
const ROUND_SECONDS = 60;

const laneColors = ["#ff3b3b","#2f7bff","#ffcc33","#36ff7a","#8b5bff","#ff4bd1"];
const carFiles = Array.from({length: LANES}, (_,i)=>`assets/clean/car_${String(i+1).padStart(2,"0")}.png`);
const finishPng = "assets/clean/a_digital_2d_rendering_showcases_a_drag_racing_fin.png";
const startPng  = "assets/clean/a_2d_digital_illustration_depicts_a_futuristic_gar.png";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const el = {
  bankValue: document.getElementById("bankValue"),
  roundValue: document.getElementById("roundValue"),
  timeValue: document.getElementById("timeValue"),
  feed: document.getElementById("feed"),
  btnStart: document.getElementById("btnStart"),
  btnReset: document.getElementById("btnReset"),
  btnNext: document.getElementById("btnNext"),
  winner: document.getElementById("winner"),
  winnerLane: document.getElementById("winnerLane"),
  hit: document.getElementById("hit"),
  winsTotal: document.getElementById("winsTotal"),
  winsGrid: document.getElementById("winsGrid"),
};

function fmt(n){ return String(n).padStart(2,"0"); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }


function loadWins(){
  try{
    const raw = localStorage.getItem("ddr_wins_v3");
    if(!raw) return;
    const obj = JSON.parse(raw);
    if(Array.isArray(obj.wins) && obj.wins.length === LANES){
      state.wins = obj.wins.map(x=>Number(x)||0);
    }
  }catch(e){}
}
function saveWins(){
  try{
    localStorage.setItem("ddr_wins_v3", JSON.stringify({ wins: state.wins }));
  }catch(e){}
}
function renderWins(){
  if(!el.winsGrid || !el.winsTotal) return;
  el.winsGrid.innerHTML = "";
  let total = 0;
  for(let i=0;i<LANES;i++){
    total += state.wins[i];
    const chip = document.createElement("div");
    chip.className = "win-chip";
    const left = document.createElement("div");
    left.className = "lbl";
    left.textContent = `Полоса ${i+1}`;
    const right = document.createElement("div");
    right.className = "val";
    right.textContent = state.wins[i];
    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "999px";
    dot.style.background = laneColors[i];
    dot.style.boxShadow = "0 0 12px rgba(255,255,255,0.22)";
    chip.appendChild(dot);
    chip.appendChild(left);
    chip.appendChild(right);
    el.winsGrid.appendChild(chip);
  }
  el.winsTotal.textContent = total;
}

function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = (e)=>rej(new Error("Failed to load: " + src));
    img.src = src;
  });
}

const assets = { cars: [], finish:null, start:null, carsOk: [], errs: [] };
let assetsReady = false;
let assetMsg = '';


const state = {
  running:false,
  timeLeft: ROUND_SECONDS,
  bank:0,
  round:1,
  selectedDonate:5,
  pos: Array.from({length:LANES}, ()=>0),
  speed: Array.from({length:LANES}, ()=>0.11 + Math.random()*0.03),
  boost: Array.from({length:LANES}, ()=>0),
  winner: null,
  wins: Array.from({length:LANES}, ()=>0),
};

const road = {
  vanishX: 0.50,
  topY: 0.13,
  bottomY: 0.88,
  topWidth: 0.26,
  bottomWidth: 0.86,
};

function roadWidth(t){ return lerp(road.bottomWidth, road.topWidth, t); }
function roadCenterX(t){ return lerp(0.50, road.vanishX, t); }
function roadY(t){ return lerp(road.bottomY, road.topY, t); }
function roadEdges(t){
  const w = roadWidth(t);
  const cx = roadCenterX(t);
  return { left: cx - w/2, right: cx + w/2, y: roadY(t) };
}
function laneCenterX(i, t){
  const e = roadEdges(t);
  const laneW = (e.right - e.left) / LANES;
  let cx = e.left + laneW*(i+0.5);
  const phase = i * 0.9;
  cx += Math.sin((t*3.2 + phase)*Math.PI) * 0.007 * (1 - t);
  return cx;
}
function laneHitIndex(xNorm){
  const t = 0.08;
  const e = roadEdges(t);
  if(xNorm < e.left || xNorm > e.right) return null;
  const laneW = (e.right - e.left) / LANES;
  return clamp(Math.floor((xNorm - e.left)/laneW), 0, LANES-1);
}

function addFeed(name, laneIdx, amount){
  const item = document.createElement("div");
  item.className = "feed-item";
  const left = document.createElement("div");
  left.className = "feed-left";
  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = laneColors[laneIdx];
  const nm = document.createElement("div");
  nm.className = "feed-name";
  nm.textContent = `${name} → L${laneIdx+1}`;
  left.appendChild(dot); left.appendChild(nm);
  const amt = document.createElement("div");
  amt.className = "feed-amt";
  amt.textContent = amount ? `+${amount}` : "WIN";
  item.appendChild(left); item.appendChild(amt);
  el.feed.prepend(item);
  while(el.feed.children.length > 7) el.feed.removeChild(el.feed.lastChild);
}

function donateToLane(laneIdx, amount){
  if(state.winner !== null) return;
  state.bank += amount;
  el.bankValue.textContent = state.bank;
loadWins();
renderWins();
  const b = amount <= 1 ? 0.03 : amount <= 5 ? 0.06 : amount <= 20 ? 0.12 : 0.20;
  state.boost[laneIdx] = clamp(state.boost[laneIdx] + b, 0, 0.48);
  const names = ["pluto","dima","katya","neo","vova","queen","ghost","max"];
  addFeed(names[Math.floor(Math.random()*names.length)], laneIdx, amount);
}

function toggleStart(){
  if(state.winner !== null) return;
  state.running = !state.running;
  el.btnStart.textContent = state.running ? "Пауза" : "Старт";
}
function resetRound(){
  state.running = false;
  state.timeLeft = ROUND_SECONDS;
  state.bank = 0;
  state.pos = state.pos.map(()=>0);
  state.boost = state.boost.map(()=>0);
  state.speed = state.speed.map(()=>0.11 + Math.random()*0.03);
  state.winner = null;
  el.feed.innerHTML = "";
  el.bankValue.textContent = state.bank;
loadWins();
renderWins();
  el.timeValue.textContent = state.timeLeft;
  el.btnStart.textContent = "Старт";
  el.winner.hidden = true;
}
function nextRound(){
  state.round += 1;
  el.roundValue.textContent = fmt(state.round);
  resetRound();
}

el.btnStart.addEventListener("click", toggleStart);
el.btnReset.addEventListener("click", resetRound);
el.btnNext.addEventListener("click", nextRound);

document.querySelectorAll("[data-d]").forEach(btn=>{
  btn.addEventListener("click", ()=> state.selectedDonate = Number(btn.getAttribute("data-d")));
});

el.roundValue.textContent = fmt(state.round);
el.timeValue.textContent = state.timeLeft;
el.bankValue.textContent = state.bank;
loadWins();
renderWins();

el.hit.addEventListener("pointerdown", (ev)=>{
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / rect.width;
  const idx = laneHitIndex(x);
  if(idx === null) return;
  donateToLane(idx, state.selectedDonate);
});

function resize(){
  canvas.width = 1080;
  canvas.height = 1920;
}
window.addEventListener("resize", resize);
resize();

function n2px(xn, yn){ return { x: xn*canvas.width, y: yn*canvas.height }; }

function drawRoad(){
  const top = roadEdges(1);
  const bot = roadEdges(0);
  const p1 = n2px(top.left, top.y);
  const p2 = n2px(top.right, top.y);
  const p3 = n2px(bot.right, bot.y);
  const p4 = n2px(bot.left, bot.y);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, p1.y, 0, p3.y);
  g.addColorStop(0, "rgba(18,20,30,0.92)");
  g.addColorStop(1, "rgba(10,11,18,0.98)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // edge lines
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y); ctx.lineTo(p4.x,p4.y);
  ctx.moveTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y);
  ctx.stroke();
  ctx.restore();

  // dashed lane lines
  ctx.save();
  for(let i=1;i<LANES;i++){
    for(let seg=0; seg<26; seg++){
      if(seg % 2 === 1) continue;
      const t0 = seg/26;
      const t1 = (seg+0.55)/26;
      const y0 = lerp(road.bottomY, road.topY, t0);
      const y1 = lerp(road.bottomY, road.topY, t1);
      const tx0 = (road.bottomY - y0) / (road.bottomY - road.topY);
      const tx1 = (road.bottomY - y1) / (road.bottomY - road.topY);
      const x0 = laneCenterX(i-0.5, tx0);
      const x1 = laneCenterX(i-0.5, tx1);
      const a = n2px(x0, y0);
      const b = n2px(x1, y1);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = lerp(6, 2, tx0);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStartAndFinish(){
  if(assets.finish){
    const w = canvas.width * 0.92;
    const scale = w / assets.finish.width;
    const h = assets.finish.height * scale;
    ctx.drawImage(assets.finish, (canvas.width-w)/2, canvas.height*0.02, w, h);
  }
  if(assets.start){
    const w = canvas.width * 1.05;
    const scale = w / assets.start.width;
    const h = assets.start.height * scale;
    ctx.drawImage(assets.start, (canvas.width-w)/2, canvas.height*0.70, w, h);
  }

  // finish checkered band
  const t = 1.0;
  const e = roadEdges(t);
  const y = e.y + 0.02;
  const left = n2px(e.left, y);
  const right = n2px(e.right, y);
  const bandH = canvas.height * 0.012;
  const squares = 24;
  const sqW = (right.x-left.x)/squares;
  for(let i=0;i<squares;i++){
    ctx.fillStyle = i%2==0 ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";
    ctx.fillRect(left.x + i*sqW, left.y, sqW, bandH);
  }

  // start line
  const e0 = roadEdges(0.0);
  const y0 = e0.y - 0.01;
  const l0 = n2px(e0.left, y0);
  const r0 = n2px(e0.right, y0);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(l0.x,l0.y); ctx.lineTo(r0.x,r0.y); ctx.stroke();
}

function drawTrails(){
  for(let i=0;i<LANES;i++){
    const p = state.pos[i];
    const c = laneColors[i];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = c;
    ctx.lineCap = "round";

    const steps = 24;
    for(let s=0;s<steps;s++){
      const tA = (s/steps) * p;
      const tB = ((s+1)/steps) * p;
      const A = n2px(laneCenterX(i,tA), roadY(tA));
      const B = n2px(laneCenterX(i,tB), roadY(tB));
      ctx.lineWidth = lerp(18, 3.5, tA);
      ctx.globalAlpha = p>0 ? lerp(0.12, 0.85, (tB/p)) : 0;
      ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
    }

    const intensity = clamp(state.boost[i]/0.48, 0, 1);
    ctx.globalAlpha = 0.30 + intensity*0.40;
    ctx.shadowColor = c;
    ctx.shadowBlur = 18 + intensity*22;
    const X = n2px(laneCenterX(i,p), roadY(p));
    ctx.beginPath(); ctx.arc(X.x, X.y, 10 + intensity*10, 0, Math.PI*2);
    ctx.fillStyle = c;
    ctx.fill();

    ctx.restore();
  }
}

function drawFallbackCar(i, P, t, w, h){
  // simple rounded rectangle + glow as fallback if PNG failed
  const c = laneColors[i];
  ctx.save();
  ctx.translate(P.x, P.y);
  const rot = Math.sin((t*2.4 + i*0.6)*Math.PI) * 0.03 * (1-t);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = c;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.85;
  const r = Math.max(6, w*0.18);
  ctx.fillStyle = c;
  roundRect(-w/2, -h/2, w, h, r);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function drawDebug(){
  if(!assetsReady) return;
  if(!assetMsg) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(20, 20, canvas.width-40, 90);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("⚠ " + assetMsg, 40, 78);
  ctx.restore();
}

function drawCars(){
  for(let i=0;i<LANES;i++){
    const img = assets.cars[i];
    // if PNG not loaded, draw fallback

    const t = state.pos[i];
    const P = n2px(laneCenterX(i,t), roadY(t));
    const scale = lerp(1.05, 0.32, t);
    const w = canvas.width * 0.10 * scale;
    const h = w * (img.height/img.width);

    ctx.save();
    ctx.translate(P.x, P.y);
    const rot = Math.sin((t*2.4 + i*0.6)*Math.PI) * 0.03 * (1-t);
    ctx.rotate(rot);

    ctx.globalAlpha = 0.55;
    ctx.filter = "blur(6px)";
    ctx.drawImage(img, -w/2, -h/2 + 10*scale, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.drawImage(img, -w/2, -h/2, w, h);
    ctx.restore();
  }
}

function checkWinner(){
  if(state.winner !== null) return;
  for(let i=0;i<LANES;i++){
    if(state.pos[i] >= 1){
      state.winner = i;
      state.running = false;
      el.btnStart.textContent = "Старт";
      el.winnerLane.textContent = `Полоса ${i+1}`;
      el.winner.hidden = false;
      addFeed("SYSTEM", i, 0);
      // wins counter
      state.wins[i] = (state.wins[i]||0) + 1;
      saveWins();
      renderWins();
      // auto-loop next round after 2.5s
      setTimeout(()=>{
        if(state.winner !== null) nextRound();
      }, 2500);
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
    el.btnStart.textContent = "Старт";
  }
  el.timeValue.textContent = Math.ceil(state.timeLeft);

  for(let i=0;i<LANES;i++){
    const v = state.speed[i] + state.boost[i];
    const drag = lerp(1.0, 0.65, state.pos[i]);
    state.pos[i] = clamp(state.pos[i] + v * dt * 0.35 * drag, 0, 1.2);
    state.boost[i] = Math.max(0, state.boost[i] - dt * 0.14);
  }
  checkWinner();
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // subtle haze
  const haze = ctx.createLinearGradient(0,0,0,canvas.height);
  haze.addColorStop(0, "rgba(0,0,0,0.00)");
  haze.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = haze;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  drawRoad();
  drawTrails();
  drawCars();
  drawStartAndFinish();
  drawDebug();
}

async function boot(){
  // Try clean/ first; if missing, fall back to legacy assets/ paths.
  const altCarFiles = Array.from({length: LANES}, (_,i)=>`assets/car_${String(i+1).padStart(2,"0")}.png`);
  const altFinish = "assets/a_digital_2d_rendering_showcases_a_drag_racing_fin.png";
  const altStart  = "assets/a_2d_digital_illustration_depicts_a_futuristic_gar.png";

  const carRes = await Promise.allSettled(carFiles.map(loadImage));
  assets.cars = [];
  assets.carsOk = [];
  for(let i=0;i<carRes.length;i++){
    if(carRes[i].status === "fulfilled"){
      assets.cars[i] = carRes[i].value;
      assets.carsOk[i] = true;
    } else {
      assets.carsOk[i] = false;
      assets.errs.push(carRes[i].reason?.message || String(carRes[i].reason));
    }
  }
  // If most cars failed, try legacy paths
  const okCount = assets.carsOk.filter(Boolean).length;
  if(okCount < Math.ceil(LANES/2)){
    const carRes2 = await Promise.allSettled(altCarFiles.map(loadImage));
    for(let i=0;i<carRes2.length;i++){
      if(carRes2[i].status === "fulfilled"){
        assets.cars[i] = carRes2[i].value;
        assets.carsOk[i] = true;
      }
    }
  }

  const fin = await Promise.allSettled([loadImage(finishPng), loadImage(altFinish)]);
  assets.finish = fin[0].status==="fulfilled" ? fin[0].value : (fin[1].status==="fulfilled" ? fin[1].value : null);
  const st = await Promise.allSettled([loadImage(startPng), loadImage(altStart)]);
  assets.start = st[0].status==="fulfilled" ? st[0].value : (st[1].status==="fulfilled" ? st[1].value : null);

  assetsReady = true;

  const missingCars = assets.carsOk.filter(x=>!x).length;
  if(missingCars > 0 || !assets.finish || !assets.start){
    assetMsg = `Assets: cars missing ${missingCars}/${LANES}, finish ${assets.finish? "ok":"missing"}, start ${assets.start? "ok":"missing"}`;
    console.warn(assetMsg, assets.errs);
  }
  render();
}
boot();

let last = performance.now();
function loop(now){
  const dt = (now-last)/1000;
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// demo auto-donates
function demoDonate(){
  if(!state.running || state.winner !== null) return;
  if(Math.random() < 0.12){
    donateToLane(Math.floor(Math.random()*LANES), [1,5,20,50][Math.floor(Math.random()*4)]);
  }
}
setInterval(demoDonate, 650);
