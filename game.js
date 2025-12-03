console.log("game.js loaded");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const scoreGreenEl = document.getElementById("scoreGreen");
const scorePurpleEl = document.getElementById("scorePurple");
const overlay = document.getElementById("overlay");
const resultText = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");

// Enhanced UI elements
const currentMapEl = document.getElementById("current-map");
const mapSwitchBtn = document.getElementById("map-switch");
const activePowerupsEl = document.getElementById("active-powerups");
const finalFlamesEl = document.getElementById("final-flames");
const finalScoreEl = document.getElementById("final-score");

// Character selection elements
const characterBtn = document.getElementById("characterBtn");
const characterSelection = document.getElementById("character-selection");
const ghostTypes = document.querySelectorAll(".ghost-type");
const hatOptions = document.getElementById("hat-collection");
const applyCharacterBtn = document.getElementById("apply-character");
const cancelCharacterBtn = document.getElementById("cancel-character");

// Progress display elements
const totalFlamesEl = document.getElementById("total-flames");
const totalGamesEl = document.getElementById("total-games");
const totalScoreDisplayEl = document.getElementById("total-score-display");
const totalPowerupsEl = document.getElementById("total-powerups");

// --- Game constants ---
const GAME_DURATION_MS = 120000; // 2 minutes
const NUM_PLAYERS_PER_TEAM = 4; // 4v4 gameplay
const NUM_FLAMES = 80; // More flames for more players

const GHOST_RADIUS = 14;
const FLAME_RADIUS = 6;
const BASE_RADIUS = 60;
const MAP_MARGIN = 60;
const STEAL_DISTANCE = 18;
const FLAME_RESPAWN_DELAY = 3000;

// New power-up types
const POWERUP_TYPES = {
  SPEED: 'speed',
  MAGNET: 'magnet',
  INVINCIBILITY: 'invincibility',
  NIGHT_VISION: 'night_vision'
};

// Achievement system
const ACHIEVEMENTS = {
  FLAME_COLLECTOR: { name: 'Flame Collector', requirement: 50, hat: '🎩' },
  SPEED_DEMON: { name: 'Speed Demon', requirement: 25, hat: '⚡' },
  TEAM_PLAYER: { name: 'Team Player', requirement: 100, hat: '👑' },
  UNSTOPPABLE: { name: 'Unstoppable', requirement: 30, hat: '🔥' },
  GHOST_HUNTER: { name: 'Ghost Hunter', requirement: 20, hat: '💀' },
  MASTER_THIEF: { name: 'Master Thief', requirement: 15, hat: '🎭' },
  FLAME_GUARDIAN: { name: 'Flame Guardian', requirement: 10, hat: '🛡️' },
  SPIRIT_WARRIOR: { name: 'Spirit Warrior', requirement: 200, hat: '⚔️' },
  HALLOWEEN_HERO: { name: 'Halloween Hero', requirement: 500, hat: '🦇' },
  PUMPKIN_KING: { name: 'Pumpkin King', requirement: 1000, hat: '🎃' },
  MIDNIGHT_GHOST: { name: 'Midnight Ghost', requirement: 75, hat: '🌙' },
  SPECTRAL_LEGEND: { name: 'Spectral Legend', requirement: 2000, hat: '👻' }
};

let keys = {};
let ghosts = [];
let flames = [];
let bases = [];
let particles = [];
let powerups = [];

let startTime = 0;
let gameOver = false;
let currentMap = 0;

// Achievement and progression tracking
let playerStats = {
  flamesCollected: parseInt(localStorage.getItem('flamesCollected') || '0'),
  gamesPlayed: parseInt(localStorage.getItem('gamesPlayed') || '0'),
  totalScore: parseInt(localStorage.getItem('totalScore') || '0'),
  stealsPerformed: parseInt(localStorage.getItem('stealsPerformed') || '0'),
  powerupsUsed: parseInt(localStorage.getItem('powerupsUsed') || '0'),
  selectedHat: localStorage.getItem('selectedHat') || '',
  unlockedAchievements: JSON.parse(localStorage.getItem('unlockedAchievements') || '[]')
};

let maps = [];

// Map configurations
function initMaps() {
  maps = [
    {
      name: 'Classic Graveyard',
      obstacles: [],
      theme: 'classic',
      fogIntensity: 0.12
    },
    {
      name: 'Haunted Forest',
      obstacles: [
        { x: 300, y: 200, width: 80, height: 60, type: 'tree' },
        { x: 500, y: 400, width: 80, height: 60, type: 'tree' },
        { x: 800, y: 250, width: 80, height: 60, type: 'tree' },
        { x: 1000, y: 500, width: 80, height: 60, type: 'tree' }
      ],
      theme: 'forest',
      fogIntensity: 0.18
    },
    {
      name: 'Spooky Mansion',
      obstacles: [
        { x: 400, y: 300, width: 120, height: 100, type: 'mansion' },
        { x: 700, y: 450, width: 60, height: 80, type: 'pillar' },
        { x: 600, y: 200, width: 60, height: 80, type: 'pillar' }
      ],
      theme: 'mansion',
      fogIntensity: 0.15
    }
  ];
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

// Utility
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------- Enhanced Background with map themes ----------
function drawBackground(now) {
  const w = canvas.width;
  const h = canvas.height;
  const map = maps[currentMap];

  // Base background with map theme variations
  ctx.save();
  let vignette;
  
  switch(map.theme) {
    case 'forest':
      vignette = ctx.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h / 2, Math.max(w, h));
      vignette.addColorStop(0, "rgba(60, 90, 60, 0.2)");
      vignette.addColorStop(1, "rgba(10, 20, 5, 0.0)");
      break;
    case 'mansion':
      vignette = ctx.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h / 2, Math.max(w, h));
      vignette.addColorStop(0, "rgba(120, 80, 40, 0.15)");
      vignette.addColorStop(1, "rgba(30, 20, 10, 0.0)");
      break;
    default: // classic
      vignette = ctx.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h / 2, Math.max(w, h));
      vignette.addColorStop(0, "rgba(90, 60, 170, 0.18)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.0)");
      break;
  }
  
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Enhanced moving fog with map-specific intensity
  ctx.save();
  ctx.globalAlpha = map.fogIntensity;
  ctx.translate(0, (now * 0.01) % 80);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  
  switch(map.theme) {
    case 'forest':
      grad.addColorStop(0, "#0a1f0a");
      grad.addColorStop(0.5, "#1a3f1a");
      grad.addColorStop(1, "#0a1f0a");
      break;
    case 'mansion':
      grad.addColorStop(0, "#2a1810");
      grad.addColorStop(0.5, "#4a3020");
      grad.addColorStop(1, "#2a1810");
      break;
    default:
      grad.addColorStop(0, "#120720");
      grad.addColorStop(0.5, "#1b0a31");
      grad.addColorStop(1, "#120720");
      break;
  }
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, -80, w, h + 160);
  ctx.restore();

  // Enhanced center divider with pulsing effect
  ctx.save();
  const dividerPulse = 0.08 + 0.04 * Math.sin(now * 0.003);
  ctx.strokeStyle = `rgba(255,255,255,${dividerPulse})`;
  ctx.setLineDash([8, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2, MAP_MARGIN);
  ctx.lineTo(w / 2, h - MAP_MARGIN);
  ctx.stroke();
  ctx.restore();

  // Draw map obstacles
  drawMapObstacles(now);
}

function drawMapObstacles(now) {
  const map = maps[currentMap];
  if (!map.obstacles) return;

  ctx.save();
  for (const obstacle of map.obstacles) {
    drawObstacle(obstacle, now);
  }
  ctx.restore();
}

function drawObstacle(obstacle, now) {
  const pulse = 1 + 0.03 * Math.sin(now * 0.002);
  
  ctx.save();
  ctx.translate(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2);
  ctx.scale(pulse, pulse);
  ctx.translate(-obstacle.width/2, -obstacle.height/2);
  
  switch(obstacle.type) {
    case 'tree':
      // Tree trunk
      ctx.fillStyle = 'rgba(101, 67, 33, 0.8)';
      ctx.fillRect(obstacle.width * 0.3, obstacle.height * 0.6, obstacle.width * 0.4, obstacle.height * 0.4);
      // Tree foliage
      ctx.fillStyle = 'rgba(34, 87, 34, 0.9)';
      ctx.beginPath();
      ctx.ellipse(obstacle.width/2, obstacle.height * 0.3, obstacle.width * 0.4, obstacle.height * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mansion':
      // Mansion walls
      ctx.fillStyle = 'rgba(70, 50, 80, 0.9)';
      ctx.fillRect(0, 0, obstacle.width, obstacle.height);
      // Windows
      ctx.fillStyle = 'rgba(255, 220, 100, 0.6)';
      ctx.fillRect(obstacle.width * 0.2, obstacle.height * 0.3, obstacle.width * 0.15, obstacle.height * 0.25);
      ctx.fillRect(obstacle.width * 0.65, obstacle.height * 0.3, obstacle.width * 0.15, obstacle.height * 0.25);
      break;
    case 'pillar':
      // Stone pillar
      ctx.fillStyle = 'rgba(90, 90, 100, 0.8)';
      ctx.fillRect(0, 0, obstacle.width, obstacle.height);
      // Pillar details
      ctx.strokeStyle = 'rgba(120, 120, 130, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(obstacle.width * 0.1, 0, obstacle.width * 0.8, obstacle.height);
      break;
  }
  
  ctx.restore();
}

// ---------- PowerUp ----------
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.alive = true;
    this.spawnTime = performance.now();
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    // Gentle floating motion
    const age = (performance.now() - this.spawnTime) * 0.002;
    this.y += Math.sin(age + this.bobPhase) * 0.02;
  }

  draw(now) {
    if (!this.alive) return;

    const age = (now - this.spawnTime) * 0.003;
    const pulse = 1 + 0.15 * Math.sin(age);
    const size = 16 * pulse;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow effect
    const gradient = ctx.createRadialGradient(0, 0, 3, 0, 0, size * 1.5);
    
    if (this.type === POWERUP_TYPES.INVINCIBILITY) {
      // Jack-o'-lantern
      gradient.addColorStop(0, "rgba(255, 140, 0, 0.8)");
      gradient.addColorStop(1, "rgba(255, 100, 0, 0.0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Jack-o'-lantern body
      ctx.fillStyle = "#ff8c00";
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = "#000";
      // Eyes
      ctx.beginPath();
      ctx.ellipse(-6, -3, 3, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(6, -3, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      ctx.beginPath();
      ctx.arc(0, 5, 8, 0, Math.PI, false);
      ctx.fill();
      
    } else if (this.type === POWERUP_TYPES.NIGHT_VISION) {
      // Night vision (glowing eye)
      gradient.addColorStop(0, "rgba(100, 255, 255, 0.8)");
      gradient.addColorStop(1, "rgba(0, 150, 200, 0.0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.8, size * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.3, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
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

// ---------- Enhanced Ghost ----------
class Ghost {
  constructor(x, y, team, isPlayer = false, characterType = 0) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.isPlayer = isPlayer;
    this.characterType = characterType; // 0-3 for different ghost types

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
    this.totalSteals = 0;
    this.speedBoostUntil = 0;
    this.magnetUntil = 0;
    this.invincibilityUntil = 0; // New power-up
    this.nightVisionUntil = 0;   // New power-up

    this.targetFlame = null;
    this.bobPhase = Math.random() * Math.PI * 2;
    
    // Hat cosmetic
    this.hat = playerStats.selectedHat || '';
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

  updateBotAI(allFlames, myBase, obstacles) {
    // go home if carrying many
    if (this.carrying >= 15) {
      const toBaseX = myBase.x - this.x;
      const toBaseY = myBase.y - this.y;
      const len = Math.hypot(toBaseX, toBaseY);
      this.dirX = toBaseX / len;
      this.dirY = toBaseY / len;
      return;
    }

    // Enhanced target selection with obstacle awareness
    if (!this.targetFlame || !this.targetFlame.alive) {
      let best = null;
      let bestDist = Infinity;
      for (const f of allFlames) {
        if (!f.alive) continue;
        
        // Territorial AI - prefer flames on own side
        if (this.team === "green" && f.x > canvas.width * 0.75) continue;
        if (this.team === "purple" && f.x < canvas.width * 0.25) continue;
        
        const d = distance(this, f);
        // Bonus for closer flames
        const adjustedDist = d - (this.carrying * 5); // Prefer flames when already carrying
        
        if (adjustedDist < bestDist) {
          bestDist = adjustedDist;
          best = f;
        }
      }
      this.targetFlame = best;
    }

    if (this.targetFlame && this.targetFlame.alive) {
      let dx = this.targetFlame.x - this.x;
      let dy = this.targetFlame.y - this.y;
      
      // Simple obstacle avoidance
      for (const obs of obstacles || []) {
        const obsX = obs.x + obs.width/2;
        const obsY = obs.y + obs.height/2;
        const distToObs = distance(this, {x: obsX, y: obsY});
        
        if (distToObs < 80) {
          const avoidX = this.x - obsX;
          const avoidY = this.y - obsY;
          const avoidLen = Math.hypot(avoidX, avoidY);
          if (avoidLen > 0) {
            dx += (avoidX / avoidLen) * 30;
            dy += (avoidY / avoidLen) * 30;
          }
        }
      }
      
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const tx = dx / len;
        const ty = dy / len;
        const lerp = 0.12;
        this.dirX = this.dirX * (1 - lerp) + tx * lerp;
        this.dirY = this.dirY * (1 - lerp) + ty * lerp;
      }
    } else {
      // Random movement when no target
      if (Math.random() < 0.03) {
        const ang = Math.random() * Math.PI * 2;
        this.dirX = Math.cos(ang);
        this.dirY = Math.sin(ang);
      }
    }
  }

  applyPowerups(now) {
    this.speed = this.baseSpeed;
    
    // Speed boost
    if (now < this.speedBoostUntil) {
      this.speed *= 1.8;
    }
    
    // Invincibility makes ghost immune to stealing
    this.isInvincible = now < this.invincibilityUntil;
    
    // Night vision increases flame detection range
    this.hasNightVision = now < this.nightVisionUntil;
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
    const detectionRange = this.hasNightVision ? 12 : 4; // Enhanced range with night vision
    
    for (const flame of allFlames) {
      if (!flame.alive) continue;
      if (distance(this, flame) < GHOST_RADIUS + FLAME_RADIUS + detectionRange) {
        flame.alive = false;
        this.carrying += 1;
        
        // Update stats
        if (this.isPlayer) {
          playerStats.flamesCollected++;
          localStorage.setItem('flamesCollected', playerStats.flamesCollected.toString());
        }
        
        spawnBurst(flame.x, flame.y, this.team === "green" ? "#7bffcf" : "#f0b3ff");

        const now = performance.now();
        // Enhanced magnet effect
        if (now < this.magnetUntil) {
          const magnetRange = this.hasNightVision ? 120 : 80;
          for (const f2 of allFlames) {
            if (!f2.alive) continue;
            if (distance(flame, f2) < magnetRange) {
              f2.alive = false;
              this.carrying += 1;
              if (this.isPlayer) {
                playerStats.flamesCollected++;
                localStorage.setItem('flamesCollected', playerStats.flamesCollected.toString());
              }
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

  // New method for collecting power-ups
  collectPowerups(allPowerups, now) {
    for (const powerup of allPowerups) {
      if (!powerup.alive) continue;
      if (distance(this, powerup) < GHOST_RADIUS + 16) {
        powerup.alive = false;
        
        // Apply power-up effect
        switch(powerup.type) {
          case POWERUP_TYPES.INVINCIBILITY:
            this.invincibilityUntil = now + 6000; // 6 seconds
            break;
          case POWERUP_TYPES.NIGHT_VISION:
            this.nightVisionUntil = now + 10000; // 10 seconds
            break;
        }
        
        if (this.isPlayer) {
          playerStats.powerupsUsed++;
          localStorage.setItem('powerupsUsed', playerStats.powerupsUsed.toString());
        }
        
        spawnBurst(powerup.x, powerup.y, "#ffdf00");
        
        // Respawn after delay
        setTimeout(() => {
          powerup.x = randRange(MAP_MARGIN, canvas.width - MAP_MARGIN);
          powerup.y = randRange(MAP_MARGIN, canvas.height - MAP_MARGIN);
          powerup.alive = true;
          powerup.spawnTime = performance.now();
        }, 15000); // 15 second respawn
      }
    }
  }

  bankIfInBase(myBase, now) {
    if (this.carrying <= 0) return;

    if (distance(this, myBase) <= BASE_RADIUS - 10) {
      this.score += this.carrying;
      this.totalBanked += this.carrying;

      // Update player stats
      if (this.isPlayer) {
        playerStats.totalScore += this.carrying;
        localStorage.setItem('totalScore', playerStats.totalScore.toString());
        checkAchievements();
      }

      // Enhanced spirit launch effect
      spawnBankTrail(this, myBase, this.carrying, this.team);

      this.carrying = 0;
      this.tail = [];

      // Enhanced power-up triggers with better thresholds
      if (this.totalBanked >= 20 && now > this.speedBoostUntil) {
        this.speedBoostUntil = now + 10000; // 10 seconds
      }
      if (this.totalBanked >= 50 && now > this.magnetUntil) {
        this.magnetUntil = now + 12000; // 12 seconds
      }
    }
  }

  stealFrom(other) {
    if (other.carrying <= 0 || this.team === other.team) return;
    if (other.isInvincible) return; // Can't steal from invincible ghosts

    for (let i = 0; i < other.tail.length; i += 2) {
      const t = other.tail[i];
      if (distance(this, t) < STEAL_DISTANCE) {
        const stolen = Math.max(1, Math.floor(other.carrying * 0.4));
        other.carrying -= stolen;
        this.carrying += stolen;
        
        // Update steal stats
        if (this.isPlayer) {
          this.totalSteals++;
          playerStats.stealsPerformed++;
          localStorage.setItem('stealsPerformed', playerStats.stealsPerformed.toString());
        }

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

    // --- Enhanced tail with different effects per power-up ---
    if (this.tail.length > 0) {
      for (let i = 0; i < this.tail.length; i += 2) {
        const p = this.tail[i];
        const age = (now - p.t) * 0.004;
        const t = i / this.tail.length;
        const r = 6 + 4 * (1 - t);
        const alpha = 0.7 * (1 - t);

        ctx.globalAlpha = alpha;
        
        // Different colors based on power-ups
        let baseCol = this.team === "green" ? "90,255,200" : "240,180,255";
        if (this.isInvincible) {
          baseCol = "255,165,0"; // Orange for invincibility
        } else if (this.hasNightVision) {
          baseCol = "100,255,255"; // Cyan for night vision
        }
        
        ctx.fillStyle = `rgba(${baseCol}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Enhanced ghost body with character variations ---
    const bob = 3 * Math.sin((now * 0.005) + this.bobPhase);
    const squish = 1 + 0.07 * Math.sin((now * 0.008) + this.bobPhase);

    ctx.translate(this.x, this.y + bob);
    ctx.scale(1, squish);

    // Enhanced glow aura with power-up effects
    const auraGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, GHOST_RADIUS * 2.2);
    let auraIntensity = 0.7;
    
    if (this.isInvincible) {
      auraGrad.addColorStop(0, "rgba(255,165,0,0.9)");
      auraGrad.addColorStop(1, "rgba(255,100,0,0.0)");
      auraIntensity = 0.9;
    } else if (this.hasNightVision) {
      auraGrad.addColorStop(0, "rgba(100,255,255,0.8)");
      auraGrad.addColorStop(1, "rgba(0,150,200,0.0)");
    } else if (this.team === "green") {
      auraGrad.addColorStop(0, "rgba(0,255,180,0.7)");
      auraGrad.addColorStop(1, "rgba(0,100,70,0.0)");
    } else {
      auraGrad.addColorStop(0, "rgba(230,170,255,0.75)");
      auraGrad.addColorStop(1, "rgba(100,40,140,0.0)");
    }
    
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, GHOST_RADIUS * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Character type variations
    const bodyColors = {
      0: this.team === "green" ? "#0aff8c" : "#d781ff", // Classic
      1: this.team === "green" ? "#00ff66" : "#e066ff", // Bright
      2: this.team === "green" ? "#66ffaa" : "#cc88ff", // Pastel  
      3: this.team === "green" ? "#44ff99" : "#bb99ff"  // Balanced
    };
    
    // Ghost body
    ctx.beginPath();
    ctx.arc(0, 0, GHOST_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = bodyColors[this.characterType] || bodyColors[0];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();

    // Character-specific facial features
    const eyeOffsetX = 5;
    const eyeOffsetY = -2;
    
    // Eyes
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

    // Character type specific details
    if (this.characterType === 1) {
      // Bright type: glowing pupils
      ctx.fillStyle = this.team === "green" ? "#00ff00" : "#ff00ff";
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 0.8, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.characterType === 2) {
      // Pastel type: softer expression
      ctx.strokeStyle = this.team === "green" ? "#66ffaa" : "#cc88ff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI);
      ctx.stroke();
    }

    // Hat cosmetic
    if (this.hat && this.isPlayer) {
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.fillText(this.hat, 0, -GHOST_RADIUS - 8);
    }

    // Player indicator ring
    if (this.isPlayer) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, GHOST_RADIUS + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Power-up indicators
    if (performance.now() < this.speedBoostUntil) {
      ctx.strokeStyle = "rgba(255,255,100,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, GHOST_RADIUS + 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (this.isInvincible) {
      ctx.strokeStyle = "rgba(255,165,0,0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, GHOST_RADIUS + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.hasNightVision) {
      // Night vision indicator - scanning lines
      ctx.strokeStyle = "rgba(100,255,255,0.6)";
      ctx.lineWidth = 1;
      const scanLines = 3;
      for (let i = 0; i < scanLines; i++) {
        const angle = (now * 0.01 + i * (Math.PI * 2 / scanLines)) % (Math.PI * 2);
        const x1 = Math.cos(angle) * (GHOST_RADIUS + 15);
        const y1 = Math.sin(angle) * (GHOST_RADIUS + 15);
        const x2 = Math.cos(angle) * (GHOST_RADIUS + 25);
        const y2 = Math.sin(angle) * (GHOST_RADIUS + 25);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

//  Enhanced particle system with more effects
class Particle {
  constructor(x, y, color, type = 'default') {
    this.x = x;
    this.y = y;
    this.vx = randRange(-1.5, 1.5);
    this.vy = randRange(-1.5, 1.5);
    this.life = type === 'bank' ? 1200 : 700; // ms
    this.birth = performance.now();
    this.color = color;
    this.type = type;
    this.size = type === 'bank' ? randRange(2, 6) : randRange(1, 4);
  }

  update(dt) {
    this.x += this.vx * dt * 0.05;
    this.y += this.vy * dt * 0.05;
    
    if (this.type === 'bank') {
      this.vy -= 0.02; // Float upward for bank effects
    }
  }

  draw(now) {
    const age = now - this.birth;
    if (age > this.life) return;

    const t = age / this.life;
    const alpha = 1 - t;
    const r = this.size + (this.type === 'bank' ? 3 : 5) * (1 - t);

    ctx.save();
    ctx.globalAlpha = alpha;
    
    if (this.type === 'bank') {
      // Enhanced glow for banking effects
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
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
  for (let i = 0; i < 18; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// Enhanced bank effect with spirit trail
function spawnBankTrail(ghost, base, count, team) {
  const col = team === "green" ? "#8bffd9" : "#f3c2ff";
  for (let i = 0; i < count * 2; i++) {
    const t = i / (count * 2);
    const px = ghost.x * (1 - t) + base.x * t + randRange(-8, 8);
    const py = ghost.y * (1 - t) + base.y * t + randRange(-8, 8);
    particles.push(new Particle(px, py, col, 'bank'));
  }
}

// Achievement checking system
function checkAchievements() {
  for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (playerStats.unlockedAchievements.includes(key)) continue;
    
    let unlocked = false;
    switch(key) {
      case 'FLAME_COLLECTOR':
        unlocked = playerStats.flamesCollected >= achievement.requirement;
        break;
      case 'SPEED_DEMON':
        unlocked = playerStats.powerupsUsed >= achievement.requirement;
        break;
      case 'TEAM_PLAYER':
        unlocked = playerStats.totalScore >= achievement.requirement;
        break;
      case 'UNSTOPPABLE':
        unlocked = playerStats.gamesPlayed >= achievement.requirement;
        break;
      case 'GHOST_HUNTER':
      case 'MASTER_THIEF':
        unlocked = playerStats.stealsPerformed >= achievement.requirement;
        break;
      default:
        unlocked = playerStats.totalScore >= achievement.requirement;
        break;
    }
    
    if (unlocked) {
      playerStats.unlockedAchievements.push(key);
      localStorage.setItem('unlockedAchievements', JSON.stringify(playerStats.unlockedAchievements));
      showAchievementNotification(achievement);
    }
  }
}

function showAchievementNotification(achievement) {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-content">
      <span class="achievement-hat">${achievement.hat}</span>
      <div>
        <div class="achievement-title">Achievement Unlocked!</div>
        <div class="achievement-name">${achievement.name}</div>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// ---------- Enhanced Init game with 4v4 structure ----------
function initGame() {
  ghosts = [];
  flames = [];
  bases = [];
  particles = [];
  powerups = [];
  gameOver = false;
  overlay.classList.add("hidden");
  
  // Initialize maps if not already done
  if (maps.length === 0) {
    initMaps();
  }

  const centerY = canvas.height / 2;
  const baseGreen = new Base(MAP_MARGIN + BASE_RADIUS + 10, centerY, "green");
  const basePurple = new Base(
    canvas.width - (MAP_MARGIN + BASE_RADIUS + 10),
    centerY,
    "purple"
  );
  bases.push(baseGreen, basePurple);

  // 4v4 team structure - Player + 3 bots per team
  const player = new Ghost(baseGreen.x, baseGreen.y, "green", true, 0);
  ghosts.push(player);

  // Green team bots (3 more to make 4 total)
  for (let i = 0; i < NUM_PLAYERS_PER_TEAM - 1; i++) {
    ghosts.push(
      new Ghost(
        baseGreen.x + randRange(-50, 50),
        centerY + randRange(-50, 50),
        "green",
        false,
        (i + 1) % 4 // Cycle through character types
      )
    );
  }

  // Purple team bots (4 total)
  for (let i = 0; i < NUM_PLAYERS_PER_TEAM; i++) {
    ghosts.push(
      new Ghost(
        basePurple.x + randRange(-50, 50),
        centerY + randRange(-50, 50),
        "purple",
        false,
        i % 4 // Cycle through character types
      )
    );
  }

  // Enhanced flame distribution
  for (let i = 0; i < NUM_FLAMES; i++) {
    let x, y;
    // Ensure flames don't spawn too close to bases or obstacles
    do {
      x = randRange(MAP_MARGIN + 50, canvas.width - MAP_MARGIN - 50);
      y = randRange(MAP_MARGIN + 50, canvas.height - MAP_MARGIN - 50);
    } while (
      distance({x, y}, baseGreen) < BASE_RADIUS + 40 ||
      distance({x, y}, basePurple) < BASE_RADIUS + 40 ||
      isPositionBlocked(x, y)
    );
    
    flames.push(new Flame(x, y));
  }

  // Add power-ups (fewer than flames, more strategic)
  for (let i = 0; i < 4; i++) {
    let x, y;
    do {
      x = randRange(MAP_MARGIN + 100, canvas.width - MAP_MARGIN - 100);
      y = randRange(MAP_MARGIN + 100, canvas.height - MAP_MARGIN - 100);
    } while (
      distance({x, y}, baseGreen) < BASE_RADIUS + 60 ||
      distance({x, y}, basePurple) < BASE_RADIUS + 60 ||
      isPositionBlocked(x, y)
    );
    
    const powerupType = i < 2 ? POWERUP_TYPES.INVINCIBILITY : POWERUP_TYPES.NIGHT_VISION;
    powerups.push(new PowerUp(x, y, powerupType));
  }

  // Update game stats
  playerStats.gamesPlayed++;
  localStorage.setItem('gamesPlayed', playerStats.gamesPlayed.toString());

  startTime = performance.now();
}

// Check if position is blocked by obstacles
function isPositionBlocked(x, y) {
  const currentMapData = maps[currentMap];
  if (!currentMapData.obstacles) return false;
  
  for (const obstacle of currentMapData.obstacles) {
    if (x >= obstacle.x - 20 && x <= obstacle.x + obstacle.width + 20 &&
        y >= obstacle.y - 20 && y <= obstacle.y + obstacle.height + 20) {
      return true;
    }
  }
  return false;
}

// UI Update functions
function updatePowerUpStatus() {
  const player = ghosts.find(g => g.isPlayer);
  if (!player) return;
  
  const now = performance.now();
  const powerups = [];
  
  if (now < player.speedBoostUntil) powerups.push("⚡");
  if (now < player.magnetUntil) powerups.push("🧲");
  if (player.isInvincible) powerups.push("🎃");
  if (player.hasNightVision) powerups.push("👁️");
  
  activePowerupsEl.textContent = powerups.join(" ");
}

function updateMapDisplay() {
  currentMapEl.textContent = maps[currentMap].name;
}

function initializeCharacterSelection() {
  // Populate achievement hats
  hatOptions.innerHTML = '<button class="hat-option selected" data-hat="">None</button>';
  
  for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (playerStats.unlockedAchievements.includes(key)) {
      const button = document.createElement('button');
      button.className = 'hat-option';
      button.dataset.hat = achievement.hat;
      button.textContent = achievement.hat;
      button.title = achievement.name;
      hatOptions.appendChild(button);
    }
  }
  
  // Update progress display
  totalFlamesEl.textContent = playerStats.flamesCollected;
  totalGamesEl.textContent = playerStats.gamesPlayed;
  totalScoreDisplayEl.textContent = playerStats.totalScore;
  totalPowerupsEl.textContent = playerStats.powerupsUsed;
}

// ---------- Enhanced Input and UI Handlers ----------
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

restartBtn.addEventListener("click", () => {
  initGame();
});

// Map switching
mapSwitchBtn.addEventListener("click", () => {
  currentMap = (currentMap + 1) % maps.length;
  updateMapDisplay();
  initGame(); // Restart with new map
});

// Character selection panel
characterBtn.addEventListener("click", () => {
  characterSelection.classList.remove("hidden");
  initializeCharacterSelection();
});

cancelCharacterBtn.addEventListener("click", () => {
  characterSelection.classList.add("hidden");
});

applyCharacterBtn.addEventListener("click", () => {
  const selectedType = document.querySelector(".ghost-type.selected")?.dataset.type || "0";
  const selectedHat = document.querySelector(".hat-option.selected")?.dataset.hat || "";
  
  // Save selections
  localStorage.setItem('selectedCharacterType', selectedType);
  localStorage.setItem('selectedHat', selectedHat);
  playerStats.selectedHat = selectedHat;
  
  characterSelection.classList.add("hidden");
  initGame(); // Restart with new character
});

// Ghost type selection
ghostTypes.forEach(btn => {
  btn.addEventListener("click", () => {
    ghostTypes.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

// Hat selection (using event delegation for dynamic hats)
hatOptions.addEventListener("click", (e) => {
  if (e.target.classList.contains("hat-option")) {
    hatOptions.querySelectorAll(".hat-option").forEach(b => b.classList.remove("selected"));
    e.target.classList.add("selected");
  }
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

  // Enhanced rendering
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

  // power-ups
  for (const p of powerups) {
    if (!p.alive) continue;
    p.update(dt);
    p.draw(now);
  }

  // Enhanced ghost movement and AI
  const currentMapData = maps[currentMap];
  for (const g of ghosts) {
    if (g.isPlayer) {
      g.updateDirectionFromKeys();
    } else {
      const myBase = g.team === "green" ? baseGreen : basePurple;
      g.updateBotAI(flames, myBase, currentMapData.obstacles);
    }
    g.move(dt);
    g.collectFlames(flames);
    g.collectPowerups(powerups, now); // New power-up collection
    const myBase = g.team === "green" ? baseGreen : basePurple;
    g.bankIfInBase(myBase, now);
  }

  // stealing with invincibility protection
  for (let i = 0; i < ghosts.length; i++) {
    for (let j = 0; j < ghosts.length; j++) {
      if (i === j) continue;
      ghosts[i].stealFrom(ghosts[j]);
    }
  }

  // Enhanced scoring
  const greenScore = ghosts
    .filter((g) => g.team === "green")
    .reduce((s, g) => s + g.score, 0);
  const purpleScore = ghosts
    .filter((g) => g.team === "purple")
    .reduce((s, g) => s + g.score, 0);
  scoreGreenEl.textContent = greenScore;
  scorePurpleEl.textContent = purpleScore;

  // Enhanced particles
  for (const p of particles) {
    p.update(dt);
    p.draw(now);
  }
  particles = particles.filter((p) => !p.isDead(now));

  // ghosts on top
  for (const g of ghosts) {
    g.draw(now);
  }

  // Update UI
  if (!gameOver) {
    updatePowerUpStatus();
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
  // Update final stats
  if (finalFlamesEl) finalFlamesEl.textContent = player ? player.totalBanked : 0;
  if (finalScoreEl) finalScoreEl.textContent = greenScore;
  overlay.classList.remove("hidden");
}

// Enhanced initialization
function initialize() {
  initMaps();
  updateMapDisplay();
  initializeCharacterSelection();
  
  initGame();
  update();
}

// start
initialize();
