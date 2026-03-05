
const VER = "na-1"; // поменяй строку если GitHub Pages кэшит

// ====== SPRITES (без атласа) ======
const SPRITES = {
  down:       { url: `assets/sprite_down.png?v=${VER}`,       frameW: 688, frameH: 464, frames: 10, fps: 12 },
  right:      { url: `assets/sprite_righ.png?v=${VER}`,       frameW: 292, frameH: 293, frames: 30, fps: 12 },
  downRight:  { url: `assets/sprite_down_right.png?v=${VER}`, frameW: 688, frameH: 464, frames: 6,  fps: 12 },
  upRight:    { url: `assets/sprite_up_right.png?v=${VER}`,   frameW: 688, frameH: 464, frames: 24, fps: 14 },
  up:         { url: `assets/sprite_up.png?v=${VER}`,         frameW: 332, frameH: 302, frames: 12, fps: 12 },
  attack:     { url: `assets/sprite_attack.png?v=${VER}`,     frameW: 459, frameH: 392, frames: 24, fps: 16 },
  death:      { url: `assets/sprite_death.png?v=${VER}`,      frameW: 688, frameH: 464, frames: 23, fps: 12 },
};

// ====== DRAGON SPRITE (loop) ======
const DRAGON_SPRITE = { url: `assets/sprite_dragon.png?v=${VER}`, frameW: 256, frameH: 256, frames: 24, fps: 12, drawW: 128, drawH: 128 };


// 8 направлений (y вниз):
// 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right
function dir8FromVector(dx, dy){
  const ang = Math.atan2(dy, dx); // -pi..pi
  const step = Math.PI / 4;       // 45°
  // стабильное разбиение (без дрожи на границах)
  let idx = Math.floor((ang + step/2) / step);
  idx = (idx % 8 + 8) % 8;
  return idx;
}

function spriteForDir8(dir8){
  // возвращаем {key, flipX}
  switch(dir8){
    case 0: return { key: "right", flipX: false };
    case 1: return { key: "downRight", flipX: false };
    case 2: return { key: "down", flipX: false };
    case 3: return { key: "downRight", flipX: true  };
    case 4: return { key: "right", flipX: true  };
    case 5: return { key: "upRight", flipX: true  };
    case 6: return { key: "up", flipX: false };
    case 7: return { key: "upRight", flipX: false };
    default: return { key: "down", flipX: false };
  }
}

// ====== DOM ======
const stage = document.getElementById("stage");
const playerEl = document.getElementById("player");
const playerSpriteEl = document.getElementById("playerSprite");
const playerHPFill = document.getElementById("playerHP");
const playerLabel = document.getElementById("playerLabel");

const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");

// ====== SFX ======
const hitSfx = new Audio(`assets/hit.wav?v=${VER}`);
hitSfx.preload = "auto";
hitSfx.volume = 0.65;

// unlock audio on first user gesture (mobile/OBS browsers)
let audioUnlocked = false;
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  try{
    hitSfx.play().then(()=>{ hitSfx.pause(); hitSfx.currentTime = 0; }).catch(()=>{});
  }catch{}
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });

// ====== DAMAGE FX ======
function spawnDamageFx(x, y, amount){
  const el = document.createElement("div");
  el.className = "damage-float";
  el.textContent = `-${Math.round(amount)}`;
  el.style.left = x + "px";
  el.style.top  = y + "px";
  stage.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}
function flashDragonHurt(){
  dragonEl.classList.remove("hurt");
  // force reflow to restart animation
  void dragonEl.offsetWidth;
  dragonEl.classList.add("hurt");
}

// ====== WORLD STATE ======
const state = {
  player: {
    x: 80,
    y: 0, // выставим после первого resize
    speed: 260, // px/sec
    hp: 1000,
    maxHp: 1000,
    targetX: null,
    targetY: null,
    mode: "idle", // idle | walk | attack
    dir8: 2,
    attackAcc: 0,
  },
  dragon: {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
  }
};

// ====== ANIM ======
const anim = {
  key: "down",
  flipX: false,
  frame: 0,
  acc: 0,
};

const dragonAnim = { frame: 0, acc: 0 };

function applyDragonSprite(){
  // set up sprite sheet scaling for the dragon element
  dragonEl.style.width = DRAGON_SPRITE.drawW + "px";
  dragonEl.style.height = DRAGON_SPRITE.drawH + "px";
  dragonSpriteEl.style.width = DRAGON_SPRITE.drawW + "px";
  dragonSpriteEl.style.height = DRAGON_SPRITE.drawH + "px";
  dragonSpriteEl.style.backgroundImage = `url(${DRAGON_SPRITE.url})`;
  dragonSpriteEl.style.backgroundSize = `${DRAGON_SPRITE.frames * DRAGON_SPRITE.drawW}px ${DRAGON_SPRITE.drawH}px`;
  dragonSpriteEl.style.backgroundPosition = "0px 0px";
}

function applySprite(key, flipX){
  if (anim.key === key && anim.flipX === flipX) return;
  anim.key = key;
  anim.flipX = flipX;
  anim.frame = 0;
  anim.acc = 0;
  const s = SPRITES[key];
  playerSpriteEl.style.width = s.frameW + "px";
  playerSpriteEl.style.height = s.frameH + "px";
  playerSpriteEl.style.backgroundImage = `url("${s.url}")`;
  // flip делаем только на inner, чтобы якорь ног не ломался
  playerSpriteEl.style.transform = `translateX(-50%) scaleX(${flipX ? -1 : 1})`;
}

function tickAnim(dt){
  const s = SPRITES[anim.key];
  anim.acc += dt;
  const spf = 1 / (s.fps || 12);
  while (anim.acc >= spf){
    anim.acc -= spf;
    anim.frame = (anim.frame + 1) % s.frames;
  }
  const x = -anim.frame * s.frameW;
  playerSpriteEl.style.backgroundPosition = `${x}px 0px`;
}

// ====== UI ======
function tickDragon(dt){
  if (!state.dragon.alive) return;
  dragonAnim.acc += dt;
  const spf = 1 / (DRAGON_SPRITE.fps || 12);
  while (dragonAnim.acc >= spf){
    dragonAnim.acc -= spf;
    dragonAnim.frame = (dragonAnim.frame + 1) % DRAGON_SPRITE.frames;
    const x = -dragonAnim.frame * DRAGON_SPRITE.drawW;
    dragonSpriteEl.style.backgroundPosition = `${x}px 0px`;
  }
}


function setHP(fillEl, labelEl, hp, maxHp, prefix){
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  fillEl.style.width = (pct * 100).toFixed(1) + "%";
  labelEl.textContent = `${prefix} ${Math.max(0, Math.floor(hp))}/${maxHp}`;
}

// ====== LAYOUT ======
function resize(){
  const rect = stage.getBoundingClientRect();
  // старт: почти снизу слева
  state.player.y = rect.height - 40;
  state.player.x = 90;

  // дракон чуть выше центра
  state.dragon.x = rect.width * 0.52;
  state.dragon.y = rect.height * 0.43;

  placeEntities();
}
window.addEventListener("resize", resize);

function placeEntities(){
  playerEl.style.left = state.player.x + "px";
  playerEl.style.top  = state.player.y + "px";

  dragonEl.style.left = state.dragon.x + "px";
  dragonEl.style.top  = state.dragon.y + "px";
}

// ====== INPUT ======
function setTargetFromEvent(e){
  const rect = stage.getBoundingClientRect();
  const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
  const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
  state.player.targetX = x;
  state.player.targetY = y;
  if (state.player.mode !== "attack") state.player.mode = "walk";
}

stage.addEventListener("pointerdown", (e) => {
  setTargetFromEvent(e);
});
stage.addEventListener("touchstart", (e) => {
  setTargetFromEvent(e);
}, { passive: true });

// ====== COMBAT ======
const ATTACK_RANGE = 110;    // px
const HIT_DPS = 18;          // урон/сек

function updateCombat(dt){
  if (!state.dragon.alive) return;

  const dx = state.dragon.x - state.player.x;
  const dy = state.dragon.y - state.player.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= ATTACK_RANGE){
    // атакуем: лицо в сторону дракона, стоим на месте
    state.player.mode = "attack";
    state.player.targetX = null;
    state.player.targetY = null;

    state.player.dir8 = dir8FromVector(dx, dy);
    const { key, flipX } = spriteForDir8(state.player.dir8);
    applySprite("attack", flipX);

    // discrete hits (looks better + lets us add sfx/fx)
    const HIT_INTERVAL = 0.18; // seconds between hit ticks
    state.player.attackAcc += dt;
    while (state.player.attackAcc >= HIT_INTERVAL){
      state.player.attackAcc -= HIT_INTERVAL;

      const dmg = HIT_DPS * HIT_INTERVAL;
      state.dragon.hp -= dmg;

      // sfx (restart quickly)
      try{ hitSfx.currentTime = 0; hitSfx.play().catch(()=>{}); }catch{}

      // fx at dragon center (slightly above feet)
      spawnDamageFx(state.dragon.x, state.dragon.y - DRAGON_SPRITE.drawH*0.75, dmg);
      flashDragonHurt();

      if (state.dragon.hp <= 0) break;
    }
    if (state.dragon.hp <= 0){
      state.dragon.hp = 0;
      state.dragon.alive = false;
      dragonEl.style.display = "none";
      state.player.attackAcc = 0;
      state.player.mode = "idle";
    }
  } else {
    if (state.player.mode === "attack"){
      state.player.attackAcc = 0;
      // выходим из атаки, продолжаем движение (если есть цель)
      state.player.mode = (state.player.targetX != null) ? "walk" : "idle";
    }
  }
}

// ====== MOVE ======
function updateMove(dt){
  if (state.player.mode !== "walk") return;
  if (state.player.targetX == null || state.player.targetY == null) return;

  const dx = state.player.targetX - state.player.x;
  const dy = state.player.targetY - state.player.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2){
    state.player.x = state.player.targetX;
    state.player.y = state.player.targetY;
    state.player.targetX = null;
    state.player.targetY = null;
    state.player.mode = "idle";
    return;
  }

  const vx = dx / dist;
  const vy = dy / dist;

  state.player.x += vx * state.player.speed * dt;
  state.player.y += vy * state.player.speed * dt;

  // автонаправление
  state.player.dir8 = dir8FromVector(vx, vy);

  const { key, flipX } = spriteForDir8(state.player.dir8);

  // для walk используем соответствующий лист (не attack)
  applySprite(key, flipX);
}

// ====== LOOP ======
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // сначала combat (может переключить в attack)
  updateCombat(dt);

  // движение (если не attack)
  if (state.player.mode !== "attack"){
    updateMove(dt);
    if (state.player.mode === "idle"){
      // стойка: вниз, первый кадр
      applySprite("down", false);
      anim.frame = 0;
      playerSpriteEl.style.backgroundPosition = "0px 0px";
    }
  }

  tickAnim(dt);
  tickDragon(dt);
  placeEntities();

  setHP(playerHPFill, playerLabel, state.player.hp, state.player.maxHp, "HP");
  if (state.dragon.alive){
    setHP(dragonHPFill, dragonLabel, state.dragon.hp, state.dragon.maxHp, "Dragon");
  }

  requestAnimationFrame(loop);
}

// init
applySprite("down", false);
applyDragonSprite();
resize();
requestAnimationFrame(loop);
