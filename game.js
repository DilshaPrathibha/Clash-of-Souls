console.log("game.js loaded");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const scoreGreenEl = document.getElementById("scoreGreen");
const scorePurpleEl = document.getElementById("scorePurple");
const overlay = document.getElementById("overlay");
const resultText = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");

// --- Game constants ---
const GAME_DURATION_MS = 120000; // 2 minutes
const NUM_BOTS_PER_TEAM = 3;
const NUM_FLAMES = 70;

const GHOST_RADIUS = 14;
const FLAME_RADIUS = 6;
const BASE_RADIUS = 60;
const MAP_MARGIN = 60;
const STEAL_DISTANCE = 18;
const FLAME_RESPAWN_DELAY = 3000;

let keys = {};
let ghosts = [];
let flames = [];
let bases = [];
let particles = [];

let startTime = 0;
let gameOver = false;

// Utility
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ---------- Background vignette ----------
function drawBackground(now) {
  const w = canvas.width;
  const h = canvas.height;

  // base dark fill (CSS already has gradient, this just adds pulse)
  ctx.save();
  const vignette = ctx.createRadialGradient(
    w / 2,
    h * 0.1,
    0,
    w / 2,
    h / 2,
    Math.max(w, h)
  );
  vignette.addColorStop(0, "rgba(90, 60, 170, 0.18)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // subtle moving fog stripes
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.translate(0, (now * 0.01) % 80);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#120720");
  grad.addColorStop(0.5, "#1b0a31");
  grad.addColorStop(1, "#120720");
  ctx.fillStyle = grad;
  ctx.fillRect(0, -80, w, h + 160);
  ctx.restore();

  // center divider
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(w / 2, MAP_MARGIN);
  ctx.lineTo(w / 2, h - MAP_MARGIN);
  ctx.stroke();
  ctx.restore();
}

// ---------- Base ----------
class Base {
  constructor(x, y, team) {
    this.x = x;
    this.y = y;
    this.team = team; // 'green' | 'purple'
  }

  draw(now) {
    ctx.save();
    const pulse = 1 + 0.06 * Math.sin(now * 0.005 + (this.team === "green" ? 0 : Math.PI));
    const r = BASE_RADIUS * pulse;

    const grad = ctx.createRadialGradient(this.x, this.y, 6, this.x, this.y, r);
    if (this.team === "green") {
      grad.addColorStop(0, "rgba(0,255,160,0.5)");
      grad.addColorStop(1, "rgba(0,80,40,0.0)");
    } else {
      grad.addColorStop(0, "rgba(210,160,255,0.6)");
      grad.addColorStop(1, "rgba(60,20,120,0.0)");
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // soft ring
    ctx.strokeStyle =
      this.team === "green" ? "rgba(0,255,160,0.4)" : "rgba(210,160,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, BASE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

// ---------- Flame ----------
class Flame {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = randRange(-0.25, 0.25);
    this.vy = randRange(-0.25, 0.25);
    this.alive = true;
    this.spawnTime = performance.now();
    this.flickerPhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.x += this.vx * dt * 0.04;
    this.y += this.vy * dt * 0.04;

    if (this.x < MAP_MARGIN || this.x > canvas.width - MAP_MARGIN) {
      this.vx *= -1;
    }
    if (this.y < MAP_MARGIN || this.y > canvas.height - MAP_MARGIN) {
      this.vy *= -1;
    }
  }

  draw(now) {
    if (!this.alive) return;

    const age = (now - this.spawnTime) * 0.004;
    const pulse = 1 + 0.2 * Math.sin(age + this.flickerPhase);
    const outerR = 18 * pulse;
    const innerR = FLAME_RADIUS + 2 * pulse;

    ctx.save();

    // glow
    const gradient = ctx.createRadialGradient(
      this.x,
      this.y - 2,
      2,
      this.x,
      this.y,
      outerR
    );
    gradient.addColorStop(0, "rgba(255, 255, 200, 0.95)");
    gradient.addColorStop(0.4, "rgba(255, 220, 120, 0.7)");
    gradient.addColorStop(1, "rgba(255, 160, 60, 0.0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, outerR, 0, Math.PI * 2);
    ctx.fill();

    // core
    ctx.fillStyle = "#ffe66d";
    ctx.beginPath();
    ctx.arc(this.x, this.y - 1, innerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ---------- Ghost ----------
class Ghost {
  constructor(x, y, team, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.isPlayer = isPlayer;

    this.baseSpeed = 1.8;
    this.speed = this.baseSpeed;
    this.dirX = 0;
    this.dirY = 0;

    this.velX = 0;
    this.velY = 0;

    this.tail = [];              // array of {x,y, t}
    this.carrying = 0;
    this.score = 0;

    this.totalBanked = 0;
    this.speedBoostUntil = 0;
    this.magnetUntil = 0;

    this.targetFlame = null;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  // smooth input for player
  updateDirectionFromKeys() {
    let dx = 0;
    let dy = 0;
    if (keys["ArrowUp"]) dy -= 1;
    if (keys["ArrowDown"]) dy += 1;
    if (keys["ArrowLeft"]) dx -= 1;
    if (keys["ArrowRight"]) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }
    // ease towards target direction a bit (like acceleration)
    const lerp = 0.15;
    this.dirX = this.dirX * (1 - lerp) + dx * lerp;
    this.dirY = this.dirY * (1 - lerp) + dy * lerp;
  }

  updateBotAI(allFlames, myBase) {
    // go home if carrying many
    if (this.carrying >= 15) {
      const toBaseX = myBase.x - this.x;
      const toBaseY = myBase.y - this.y;
      const len = Math.hypot(toBaseX, toBaseY);
      this.dirX = toBaseX / len;
      this.dirY = toBaseY / len;
      return;
    }

    if (!this.targetFlame || !this.targetFlame.alive) {
      let best = null;
      let bestDist = Infinity;
      for (const f of allFlames) {
        if (!f.alive) continue;
        if (this.team === "green" && f.x > canvas.width * 0.7) continue;
        if (this.team === "purple" && f.x < canvas.width * 0.3) continue;
        const d = distance(this, f);
        if (d < bestDist) {
          bestDist = d;
          best = f;
        }
      }
      this.targetFlame = best;
    }

    if (this.targetFlame && this.targetFlame.alive) {
      const dx = this.targetFlame.x - this.x;
      const dy = this.targetFlame.y - this.y;
      const len = Math.hypot(dx, dy);
      const tx = dx / len;
      const ty = dy / len;
      const lerp = 0.1;
      this.dirX = this.dirX * (1 - lerp) + tx * lerp;
      this.dirY = this.dirY * (1 - lerp) + ty * lerp;
    } else {
      if (Math.random() < 0.02) {
        const ang = Math.random() * Math.PI * 2;
        this.dirX = Math.cos(ang);
        this.dirY = Math.sin(ang);
      }
    }
  }

  applyPowerups(now) {
    this.speed = this.baseSpeed;
    if (now < this.speedBoostUntil) {
      this.speed *= 1.8;
    }
  }

  move(dt) {
    const now = performance.now();
    this.applyPowerups(now);

    const accel = 0.02 * dt * this.speed;
    this.velX += this.dirX * accel;
    this.velY += this.dirY * accel;

    // damping
    this.velX *= 0.9;
    this.velY *= 0.9;

    this.x += this.velX;
    this.y += this.velY;

    this.x = Math.max(MAP_MARGIN, Math.min(canvas.width - MAP_MARGIN, this.x));
    this.y = Math.max(MAP_MARGIN, Math.min(canvas.height - MAP_MARGIN, this.y));

    if (this.carrying > 0) {
      this.tail.unshift({ x: this.x, y: this.y, t: now });
      const maxSegments = this.carrying * 6;
      if (this.tail.length > maxSegments) {
        this.tail.length = maxSegments;
      }
    } else {
      this.tail = [];
    }
  }

  collectFlames(allFlames) {
    for (const flame of allFlames) {
      if (!flame.alive) continue;
      if (distance(this, flame) < GHOST_RADIUS + FLAME_RADIUS + 4) {
        flame.alive = false;
        this.carrying += 1;
        spawnBurst(flame.x, flame.y, this.team === "green" ? "#7bffcf" : "#f0b3ff");

        const now = performance.now();
        if (now < this.magnetUntil) {
          for (const f2 of allFlames) {
            if (!f2.alive) continue;
            if (distance(flame, f2) < 80) {
              f2.alive = false;
              this.carrying += 1;
              spawnBurst(f2.x, f2.y, this.team === "green" ? "#7bffcf" : "#f0b3ff");
            }
          }
        }

        setTimeout(() => {
          flame.x = randRange(MAP_MARGIN, canvas.width - MAP_MARGIN);
          flame.y = randRange(MAP_MARGIN, canvas.height - MAP_MARGIN);
          flame.alive = true;
          flame.spawnTime = performance.now();
        }, FLAME_RESPAWN_DELAY);
      }
    }
  }

  bankIfInBase(myBase, now) {
    if (this.carrying <= 0) return;

    if (distance(this, myBase) <= BASE_RADIUS - 10) {
      this.score += this.carrying;
      this.totalBanked += this.carrying;

      // nice spirit launch to base
      spawnBankTrail(this, myBase, this.carrying, this.team);

      this.carrying = 0;
      this.tail = [];

      if (this.totalBanked >= 15 && now > this.speedBoostUntil) {
        this.speedBoostUntil = now + 8000;
      }
      if (this.totalBanked >= 40 && now > this.magnetUntil) {
        this.magnetUntil = now + 8000;
      }
    }
  }

  stealFrom(other) {
    if (other.carrying <= 0 || this.team === other.team) return;

    for (let i = 0; i < other.tail.length; i += 2) {
      const t = other.tail[i];
      if (distance(this, t) < STEAL_DISTANCE) {
        const stolen = Math.max(1, Math.floor(other.carrying * 0.4));
        other.carrying -= stolen;
        this.carrying += stolen;

        spawnBurst(t.x, t.y, "#ffffff");

        const newLen = other.carrying * 6;
        if (other.tail.length > newLen) {
          other.tail.length = newLen;
        }
        break;
      }
    }
  }

  draw(now) {
    ctx.save();

    // --- tail as glowing spirit orbs ---
    if (this.tail.length > 0) {
      for (let i = 0; i < this.tail.length; i += 2) {
        const p = this.tail[i];
        const age = (now - p.t) * 0.004;
        const t = i / this.tail.length;
        const r = 6 + 4 * (1 - t);
        const alpha = 0.7 * (1 - t);

        ctx.globalAlpha = alpha;
        const col =
          this.team === "green" ? "rgba(90,255,200" : "rgba(240,180,255";
        ctx.fillStyle = `${col}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- ghost body with float / squish ---
    const bob = 3 * Math.sin((now * 0.005) + this.bobPhase);
    const squish = 1 + 0.07 * Math.sin((now * 0.008) + this.bobPhase);

    ctx.translate(this.x, this.y + bob);
    ctx.scale(1, squish);

    // glow aura
    const auraGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, GHOST_RADIUS * 2);
    if (this.team === "green") {
      auraGrad.addColorStop(0, "rgba(0,255,180,0.7)");
      auraGrad.addColorStop(1, "rgba(0,100,70,0.0)");
    } else {
      auraGrad.addColorStop(0, "rgba(230,170,255,0.75)");
      auraGrad.addColorStop(1, "rgba(100,40,140,0.0)");
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, GHOST_RADIUS * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // body
    const bodyColor = this.team === "green" ? "#0aff8c" : "#d781ff";
    ctx.beginPath();
    ctx.arc(0, 0, GHOST_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();

    // eyes
    const eyeOffsetX = 5;
    const eyeOffsetY = -2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // player ring
    if (this.isPlayer) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, GHOST_RADIUS + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // speed halo indicator
    if (performance.now() < this.speedBoostUntil) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, GHOST_RADIUS + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ---------- Particles ----------
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = randRange(-1.5, 1.5);
    this.vy = randRange(-1.5, 1.5);
    this.life = 700; // ms
    this.birth = performance.now();
    this.color = color;
  }

  update(dt) {
    this.x += this.vx * dt * 0.05;
    this.y += this.vy * dt * 0.05;
  }

  draw(now) {
    const age = now - this.birth;
    if (age > this.life) return;

    const t = age / this.life;
    const alpha = 1 - t;
    const r = 3 + 5 * (1 - t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead(now) {
    return now - this.birth > this.life;
  }
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// bank effect: little spirits fly to base
function spawnBankTrail(ghost, base, count, team) {
  const col = team === "green" ? "#8bffd9" : "#f3c2ff";
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const px = ghost.x * (1 - t) + base.x * t + randRange(-6, 6);
    const py = ghost.y * (1 - t) + base.y * t + randRange(-6, 6);
    particles.push(new Particle(px, py, col));
  }
}

// ---------- Init game ----------
function initGame() {
  ghosts = [];
  flames = [];
  bases = [];
  particles = [];
  gameOver = false;
  overlay.classList.add("hidden");

  const centerY = canvas.height / 2;
  const baseGreen = new Base(MAP_MARGIN + BASE_RADIUS + 10, centerY, "green");
  const basePurple = new Base(
    canvas.width - (MAP_MARGIN + BASE_RADIUS + 10),
    centerY,
    "purple"
  );
  bases.push(baseGreen, basePurple);

  const player = new Ghost(baseGreen.x, baseGreen.y, "green", true);
  ghosts.push(player);

  for (let i = 0; i < NUM_BOTS_PER_TEAM; i++) {
    ghosts.push(
      new Ghost(
        baseGreen.x + randRange(-40, 40),
        centerY + randRange(-40, 40),
        "green",
        false
      )
    );
  }

  for (let i = 0; i < NUM_BOTS_PER_TEAM + 1; i++) {
    ghosts.push(
      new Ghost(
        basePurple.x + randRange(-40, 40),
        centerY + randRange(-40, 40),
        "purple",
        false
      )
    );
  }

  for (let i = 0; i < NUM_FLAMES; i++) {
    flames.push(
      new Flame(
        randRange(MAP_MARGIN, canvas.width - MAP_MARGIN),
        randRange(MAP_MARGIN, canvas.height - MAP_MARGIN)
      )
    );
  }

  startTime = performance.now();
}

// ---------- Input ----------
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

restartBtn.addEventListener("click", () => {
  initGame();
});

// ---------- Main loop ----------
let lastFrameTime = performance.now();

function update() {
  const now = performance.now();
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  if (!gameOver) {
    const elapsed = now - startTime;
    const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
    const remSec = Math.floor(remaining / 1000);
    const mm = String(Math.floor(remSec / 60)).padStart(2, "0");
    const ss = String(remSec % 60).padStart(2, "0");
    timerEl.textContent = `${mm}:${ss}`;

    if (remaining <= 0) {
      endGame();
    }
  }

  // clear & background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(now);

  // bases
  const baseGreen = bases.find((b) => b.team === "green");
  const basePurple = bases.find((b) => b.team === "purple");
  for (const b of bases) b.draw(now);

  // flames
  for (const f of flames) {
    if (!f.alive) continue;
    f.update(dt);
    f.draw(now);
  }

  // ghosts movement
  for (const g of ghosts) {
    if (g.isPlayer) {
      g.updateDirectionFromKeys();
    } else {
      const myBase = g.team === "green" ? baseGreen : basePurple;
      g.updateBotAI(flames, myBase);
    }
    g.move(dt);
    g.collectFlames(flames);
    const myBase = g.team === "green" ? baseGreen : basePurple;
    g.bankIfInBase(myBase, now);
  }

  // stealing
  for (let i = 0; i < ghosts.length; i++) {
    for (let j = 0; j < ghosts.length; j++) {
      if (i === j) continue;
      ghosts[i].stealFrom(ghosts[j]);
    }
  }

  // scores
  const greenScore = ghosts
    .filter((g) => g.team === "green")
    .reduce((s, g) => s + g.score, 0);
  const purpleScore = ghosts
    .filter((g) => g.team === "purple")
    .reduce((s, g) => s + g.score, 0);
  scoreGreenEl.textContent = greenScore;
  scorePurpleEl.textContent = purpleScore;

  // particles
  for (const p of particles) {
    p.update(dt);
    p.draw(now);
  }
  particles = particles.filter((p) => !p.isDead(now));

  // ghosts on top
  for (const g of ghosts) {
    g.draw(now);
  }

  requestAnimationFrame(update);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;

  const greenScore = parseInt(scoreGreenEl.textContent, 10);
  const purpleScore = parseInt(scorePurpleEl.textContent, 10);

  let text;
  if (greenScore > purpleScore) {
    text = `Green Team wins! ${greenScore} – ${purpleScore}`;
  } else if (purpleScore > greenScore) {
    text = `Purple Team wins! ${purpleScore} – ${greenScore}`;
  } else {
    text = `It’s a tie! ${greenScore} – ${purpleScore}`;
  }

  resultText.textContent = text;
  overlay.classList.remove("hidden");
}

// start
initGame();
update();
