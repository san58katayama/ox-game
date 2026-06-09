/**
 * Retro Monochrome 〇× Game
 */

// 8x8 Sprite Matrices for Pixel Art
const SPRITES = {
  player: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [1, 1, 0, 1, 1, 0, 1, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
  ],
  circle: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 1, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 1, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
  ],
  cross: [
    [1, 1, 0, 0, 0, 0, 1, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 1, 0, 0, 0, 0, 1, 1]
  ]
};

// Main Game Controller
class OXGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.gridWidth = 15;
    this.gridHeight = 15;
    this.cellSize = this.canvas.width / this.gridWidth; // 20px per cell

    this.player = { x: 7, y: 7 };
    this.center = { x: 7, y: 7 };
    this.items = []; // Array of items: { x, y, type: 'circle'|'cross', id }
    this.particles = []; // Particle effects

    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('ox_best_score')) || 0;
    this.lastCollected = null; // 'circle' or 'cross'
    
    this.isPlaying = false;
    this.nextItemId = 0;

    // Timers
    this.spawnTimer = 0;
    this.moveTimer = 0;
    this.lastTime = 0;

    this.setupUI();
    this.setupControls();
    
    // Draw welcome screen
    this.render();
  }

  setupUI() {
    document.getElementById('best-score').textContent = this.formatScore(this.bestScore);
    document.getElementById('score').textContent = this.formatScore(this.score);
  }

  setupControls() {
    // Start game button
    document.getElementById('btn-start').addEventListener('click', () => {
      this.start();
    });

    // Restart button
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.start();
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      let dx = 0;
      let dy = 0;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dy = -1;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dy = 1;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dx = -1;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dx = 1;
          break;
        default:
          return; // ignore keys
      }

      e.preventDefault();
      this.movePlayer(dx, dy);
    });

    // Touch controls for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.isPlaying) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (!this.isPlaying) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 20) {
        let moveX = 0;
        let moveY = 0;
        if (absDx > absDy) {
          moveX = dx > 0 ? 1 : -1;
        } else {
          moveY = dy > 0 ? 1 : -1;
        }
        this.movePlayer(moveX, moveY);
      }
      e.preventDefault();
    }, { passive: false });
  }

  formatScore(num) {
    return String(num).padStart(4, '0');
  }

  start() {
    this.score = 0;
    this.lastCollected = null;
    this.items = [];
    this.particles = [];
    this.player = { x: 7, y: 7 };
    this.isPlaying = true;
    this.nextItemId = 0;
    this.elapsedTime = 0; // track elapsed game time in ms

    // Reset overlay displays
    document.getElementById('game-overlay').classList.remove('visible');
    document.getElementById('score').textContent = this.formatScore(this.score);
    this.updateTargetPanel();

    // Reset loop timestamps
    this.spawnTimer = 0;
    this.moveTimer = 0;
    this.lastTime = performance.now();

    // Start request animation loop
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  updateTargetPanel() {
    const lastEl = document.getElementById('last-item');
    const nextEl = document.getElementById('next-item');

    if (this.lastCollected === null) {
      lastEl.textContent = '-';
      lastEl.className = 'target-val-none';
      nextEl.textContent = 'ANY';
      nextEl.className = 'target-val-any';
    } else {
      const isCircle = this.lastCollected === 'circle';
      lastEl.textContent = isCircle ? '〇' : '×';
      lastEl.className = 'target-val-active';

      nextEl.textContent = isCircle ? '×' : '〇';
      nextEl.className = 'target-val-active';
    }
  }

  // Determine game difficulty intervals based on elapsed time (seconds)
  getSpawnInterval() {
    const elapsedSecs = this.elapsedTime / 1000;
    if (elapsedSecs <= 10) {
      return 1600; // baseline for first 10 seconds
    }
    // decrease interval by 80ms for every second beyond 10s, down to 350ms
    const activeTime = elapsedSecs - 10;
    return Math.max(350, 1600 - activeTime * 80);
  }

  getMoveInterval() {
    return 450; // constant speed, no acceleration
  }

  gameLoop(timestamp) {
    if (!this.isPlaying) return;

    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.elapsedTime += dt;
    this.spawnTimer += dt;
    this.moveTimer += dt;

    // 1. Spawning check
    if (this.spawnTimer >= this.getSpawnInterval()) {
      this.spawnTimer = 0;
      this.spawnItem();
    }

    // 2. Movement checks
    if (this.moveTimer >= this.getMoveInterval()) {
      this.moveTimer = 0;
      this.moveItemsTowardCenter();
    }

    // 3. Update active particles
    this.updateParticles(dt);

    // 4. Render frame
    this.render();

    // Keep looping
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  spawnItem() {
    // Choose random point on the perimeter grid
    let rx = 0;
    let ry = 0;
    const edge = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
    
    switch (edge) {
      case 0: // Top
        rx = Math.floor(Math.random() * this.gridWidth);
        ry = 0;
        break;
      case 1: // Right
        rx = this.gridWidth - 1;
        ry = Math.floor(Math.random() * this.gridHeight);
        break;
      case 2: // Bottom
        rx = Math.floor(Math.random() * this.gridWidth);
        ry = this.gridHeight - 1;
        break;
      case 3: // Left
        rx = 0;
        ry = Math.floor(Math.random() * this.gridHeight);
        break;
    }

    // Prevent double spawn on same coordinates
    if (this.items.some(i => i.x === rx && i.y === ry)) return;

    // Pick type: circle or cross
    const type = Math.random() < 0.5 ? 'circle' : 'cross';

    this.items.push({
      x: rx,
      y: ry,
      type: type,
      id: this.nextItemId++
    });
  }

  moveItemsTowardCenter() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Calculate vector steps to Center (7,7)
      const dx = Math.sign(this.center.x - item.x);
      const dy = Math.sign(this.center.y - item.y);

      // Move cell
      item.x += dx;
      item.y += dy;

      // Check if reached center (vanish)
      if (item.x === this.center.x && item.y === this.center.y) {
        // Spawn gentle vanish particles
        this.spawnVanishParticles(item.x, item.y);
        this.items.splice(i, 1);
      }
    }

    // Check player-item collision after items shift
    this.checkCollisions();
  }

  movePlayer(dx, dy) {
    const nextX = this.player.x + dx;
    const nextY = this.player.y + dy;

    // Keep within boundaries
    if (nextX >= 0 && nextX < this.gridWidth && nextY >= 0 && nextY < this.gridHeight) {
      this.player.x = nextX;
      this.player.y = nextY;
      
      this.checkCollisions();
    }
  }

  checkCollisions() {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (this.player.x === item.x && this.player.y === item.y) {
        // Collided!
        this.collectItem(item, i);
        return; // handle one collision per tick
      }
    }
  }

  collectItem(item, index) {
    const itemType = item.type;

    // Remove from active list
    this.items.splice(index, 1);

    // Rule Check
    if (this.lastCollected === itemType) {
      // Game Over: picked same type twice in a row
      this.gameOver();
    } else {
      // Correct alternate pickup
      this.score++;
      this.lastCollected = itemType;
      
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        localStorage.setItem('ox_best_score', this.bestScore);
        document.getElementById('best-score').textContent = this.formatScore(this.bestScore);
      }

      document.getElementById('score').textContent = this.formatScore(this.score);
      this.updateTargetPanel();

      // Trigger sparkles
      this.spawnExplodeParticles(this.player.x, this.player.y);
    }
  }

  getRank() {
    if (this.score < 10) {
      return 'ビンタ級';
    } else if (this.score <= 30) {
      return 'パンチ級';
    } else if (this.score <= 40) {
      return 'キック級';
    } else {
      return '〇×信者';
    }
  }

  gameOver() {
    this.isPlaying = false;

    // Trigger Screen shake effect
    const screenEl = document.querySelector('.arcade-screen');
    screenEl.style.animation = 'shake 0.3s';
    setTimeout(() => {
      screenEl.style.animation = '';
    }, 300);

    // Show Game Over menu
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('gameover-menu').classList.remove('hidden');
    
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('rank-val').textContent = this.getRank();
    
    document.getElementById('game-overlay').classList.add('visible');
  }

  // Particle Engine
  spawnExplodeParticles(gridX, gridY) {
    const startX = gridX * this.cellSize + this.cellSize / 2;
    const startY = gridY * this.cellSize + this.cellSize / 2;
    
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.1;
      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 250 + Math.random() * 200, // lifetime in ms
        maxLife: 450
      });
    }
  }

  spawnVanishParticles(gridX, gridY) {
    const startX = gridX * this.cellSize + this.cellSize / 2;
    const startY = gridY * this.cellSize + this.cellSize / 2;
    
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.04;
      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 150 + Math.random() * 150,
        maxLife: 300
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // Sprite Drawing helper
  drawSprite(sprite, gridX, gridY, style = 'white') {
    const spriteSize = 8;
    const scale = 1.6; // Scale factor inside cell
    
    const pixelWidth = scale;
    const startX = gridX * this.cellSize + (this.cellSize - spriteSize * scale) / 2;
    const startY = gridY * this.cellSize + (this.cellSize - spriteSize * scale) / 2;

    this.ctx.fillStyle = style === 'white' ? '#ffffff' : '#888888';
    
    for (let r = 0; r < spriteSize; r++) {
      for (let c = 0; c < spriteSize; c++) {
        if (sprite[r][c] === 1) {
          this.ctx.fillRect(
            Math.floor(startX + c * scale), 
            Math.floor(startY + r * scale), 
            Math.ceil(scale), 
            Math.ceil(scale)
          );
        }
      }
    }
  }

  render() {
    // Clear screen
    this.ctx.fillStyle = '#08080c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid Lines (Subtle dotted retro look)
    this.ctx.strokeStyle = '#14141c';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.gridWidth; i++) {
      // Vertical
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.cellSize, 0);
      this.ctx.lineTo(i * this.cellSize, this.canvas.height);
      this.ctx.stroke();

      // Horizontal
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.cellSize);
      this.ctx.lineTo(this.canvas.width, i * this.cellSize);
      this.ctx.stroke();
    }

    // Draw Center Portal cell (Dashed border)
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(
      this.center.x * this.cellSize + 2, 
      this.center.y * this.cellSize + 2, 
      this.cellSize - 4, 
      this.cellSize - 4
    );
    this.ctx.setLineDash([]); // reset

    // Draw active Items
    this.items.forEach(item => {
      const sprite = item.type === 'circle' ? SPRITES.circle : SPRITES.cross;
      this.drawSprite(sprite, item.x, item.y, 'white');
    });

    // Draw Player
    if (this.isPlaying) {
      this.drawSprite(SPRITES.player, this.player.x, this.player.y, 'white');
    } else {
      // Draw idle player at center
      this.drawSprite(SPRITES.player, 7, 7, 'grey');
    }

    // Draw active Particles
    this.ctx.fillStyle = '#ffffff';
    this.particles.forEach(p => {
      // Fades slightly over life
      const size = p.life > 150 ? 2 : 1;
      this.ctx.fillRect(Math.floor(p.x), Math.floor(p.y), size, size);
    });
  }
}

// Instantiate game on load
document.addEventListener('DOMContentLoaded', () => {
  new OXGame();
});
