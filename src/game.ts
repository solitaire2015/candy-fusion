import Matter from 'matter-js';
import { BOTTLE, CANDIES, RULES } from './config';

export { BOTTLE, CANDIES, HEIGHT, RULES, WIDTH } from './config';

export interface CandySnapshot {
  id: number;
  level: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface MergeEffect {
  id: number;
  x: number;
  y: number;
  level: number;
  /** Simulation seconds since the merge; freezes on pause and game over. */
  age: number;
}

interface Candy {
  body: Matter.Body;
  level: number;
  bornAt: number;
}

/** No browser/WeChat APIs here. A platform host owns input, storage and rendering. */
export class Game {
  state: 'playing' | 'paused' | 'over' = 'playing';
  score = 0;
  best = 0;
  aimX: number = (BOTTLE.left + BOTTLE.right) / 2;
  currentLevel = 0;
  nextLevel = 0;
  effects: MergeEffect[] = [];
  danger = 0;
  dropCooldown = 0;
  onBest?: (score: number) => void;

  private readonly engine: Matter.Engine;
  private readonly candies = new Map<number, Candy>();
  private readonly initialSeed: number;
  private randomState: number;
  private elapsed = 0;
  private accumulator = 0;
  private overflowTime = 0;
  private pendingPairs: [number, number][] = [];
  private effectId = 0;
  private disposed = false;

  constructor(seed = Date.now()) {
    this.initialSeed = seed >>> 0 || 1;
    this.randomState = this.initialSeed;
    this.engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: 8,
      velocityIterations: 8,
    });
    this.engine.gravity.y = RULES.gravity;
    // Collision handlers record candidates only. Bodies are changed after Engine.update.
    Matter.Events.on(this.engine, 'collisionStart', this.recordContacts);
    Matter.Events.on(this.engine, 'collisionActive', this.recordContacts);
    this.restart();
  }

  get bodies(): CandySnapshot[] {
    return [...this.candies.values()].map(({ body, level }) => ({
      id: body.id,
      level,
      x: body.position.x,
      y: body.position.y,
      angle: body.angle,
      radius: CANDIES[level].radius,
    }));
  }

  move(direction: number, dt: number): void {
    if (this.state !== 'playing' || this.disposed || !Number.isFinite(dt)) return;
    this.aimX += Math.max(-1, Math.min(1, direction)) * RULES.aimSpeed * Math.max(0, Math.min(dt, RULES.maxFrameDelta));
    this.clampAim();
  }

  drop(): boolean {
    if (this.disposed || this.state !== 'playing' || this.dropCooldown > 1e-7) return false;
    this.clampAim();
    this.createCandy(this.currentLevel, this.aimX, BOTTLE.spawnY, this.elapsed);
    this.currentLevel = this.nextLevel;
    this.nextLevel = this.randomLevel();
    this.clampAim();
    this.dropCooldown = RULES.dropCooldown;
    return true;
  }

  update(dt: number): void {
    if (this.disposed || this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.clampAim();
    this.accumulator += Math.min(dt, RULES.maxFrameDelta);
    let steps = 0;
    while (this.accumulator + 1e-10 >= RULES.fixedStep && steps < RULES.maxSteps && this.state === 'playing') {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - RULES.fixedStep);
      steps++;
    }
    if (steps === RULES.maxSteps) this.accumulator = Math.min(this.accumulator, RULES.fixedStep);
  }

  restart(): void {
    if (this.disposed) return;
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.engine.timing.timestamp = 0;
    this.candies.clear();
    this.pendingPairs = [];
    this.effects = [];
    this.effectId = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.overflowTime = 0;
    this.danger = 0;
    this.dropCooldown = 0;
    this.score = 0;
    this.state = 'playing';
    this.aimX = (BOTTLE.left + BOTTLE.right) / 2;
    this.randomState = this.initialSeed;
    this.currentLevel = this.randomLevel();
    this.nextLevel = this.randomLevel();
    const wallOptions = { isStatic: true, friction: 0.22, restitution: 0.1 };
    const wallTop = -180;
    const wallHeight = BOTTLE.bottom - wallTop + 40;
    const wallY = wallTop + wallHeight / 2;
    Matter.Composite.add(this.engine.world, [
      Matter.Bodies.rectangle(BOTTLE.left - 20, wallY, 40, wallHeight, wallOptions),
      Matter.Bodies.rectangle(BOTTLE.right + 20, wallY, 40, wallHeight, wallOptions),
      Matter.Bodies.rectangle((BOTTLE.left + BOTTLE.right) / 2, BOTTLE.bottom + 20, BOTTLE.right - BOTTLE.left + 80, 40, wallOptions),
    ]);
  }

  pause(): void {
    if (this.state === 'playing' && !this.disposed) {
      this.state = 'paused';
      this.accumulator = 0;
    }
  }

  resume(): void {
    if (this.state === 'paused' && !this.disposed) {
      this.state = 'playing';
      this.accumulator = 0;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    Matter.Events.off(this.engine, 'collisionStart', this.recordContacts);
    Matter.Events.off(this.engine, 'collisionActive', this.recordContacts);
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.candies.clear();
    this.pendingPairs = [];
    this.effects = [];
    this.disposed = true;
  }

  private readonly recordContacts = (event: Matter.IEventCollision<Matter.Engine>): void => {
    for (const pair of event.pairs) {
      const a = this.candies.get(pair.bodyA.id);
      const b = this.candies.get(pair.bodyB.id);
      if (a && b && a.level === b.level && a.level < CANDIES.length - 1) {
        this.pendingPairs.push([Math.min(pair.bodyA.id, pair.bodyB.id), Math.max(pair.bodyA.id, pair.bodyB.id)]);
      }
    }
  };

  private step(): void {
    this.elapsed += RULES.fixedStep;
    this.dropCooldown = Math.max(0, this.dropCooldown - RULES.fixedStep);
    for (const candy of this.candies.values()) {
      const { body } = candy;
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > RULES.maxSpeed) Matter.Body.setVelocity(body, {
        x: body.velocity.x * RULES.maxSpeed / speed,
        y: body.velocity.y * RULES.maxSpeed / speed,
      });
    }
    this.pendingPairs = [];
    Matter.Engine.update(this.engine, RULES.fixedStep * 1000);
    // Stable ordering and reservation make multi-contact merges reproducible.
    const reserved = new Set<number>();
    this.pendingPairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [idA, idB] of this.pendingPairs) {
      if (reserved.has(idA) || reserved.has(idB)) continue;
      const a = this.candies.get(idA);
      const b = this.candies.get(idB);
      if (!a || !b || a.level !== b.level || a.level === CANDIES.length - 1) continue;
      reserved.add(idA);
      reserved.add(idB);
      this.merge(a, b);
    }
    if (reserved.size > 0) {
      // Removing supports does not wake Matter's sleeping bodies. Wake the
      // whole pile once per merge batch, including bodies supported indirectly,
      // so gravity can settle it again. Also reset near-sleep counters.
      for (const { body } of this.candies.values()) Matter.Sleeping.set(body, false);
    }
    this.pendingPairs = [];
    this.containCandies();
    for (const effect of this.effects) effect.age += RULES.fixedStep;
    this.effects = this.effects.filter(effect => effect.age < RULES.effectDuration);
    this.checkOverflow();
  }

  private containCandies(): void {
    // A larger merge can temporarily squeeze neighbours into a wall before the
    // iterative solver settles. Keep the visible circular shell inside the jar
    // even during that dense-contact correction (Matter circles are polygons).
    for (const { body, level } of this.candies.values()) {
      const radius = CANDIES[level].radius;
      const x = Math.max(BOTTLE.left + radius, Math.min(BOTTLE.right - radius, body.position.x));
      const y = Math.min(BOTTLE.bottom - radius, body.position.y);
      if (x === body.position.x && y === body.position.y) continue;
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      if (x > body.position.x && vx < 0 || x < body.position.x && vx > 0) vx *= -RULES.restitution;
      if (y < body.position.y && vy > 0) vy *= -RULES.restitution;
      Matter.Body.setPosition(body, { x, y });
      Matter.Body.setVelocity(body, { x: vx, y: vy });
    }
  }

  private merge(a: Candy, b: Candy): void {
    const level = a.level + 1;
    const radius = CANDIES[level].radius;
    const x = Math.max(BOTTLE.left + radius, Math.min(BOTTLE.right - radius, (a.body.position.x + b.body.position.x) / 2));
    const y = Math.min(BOTTLE.bottom - radius, (a.body.position.y + b.body.position.y) / 2);
    const velocity = {
      x: (a.body.velocity.x + b.body.velocity.x) / 2,
      y: (a.body.velocity.y + b.body.velocity.y) / 2,
    };
    const angle = (a.body.angle + b.body.angle) / 2;
    // Preserve original grace age: merging at the mouth must not reset the loss timer.
    const bornAt = Math.min(a.bornAt, b.bornAt);
    Matter.Composite.remove(this.engine.world, [a.body, b.body]);
    this.candies.delete(a.body.id);
    this.candies.delete(b.body.id);
    const candy = this.createCandy(level, x, y, bornAt);
    Matter.Body.setVelocity(candy.body, velocity);
    Matter.Body.setAngle(candy.body, angle);
    this.effects.push({ id: ++this.effectId, x, y, level, age: 0 });
    this.score += CANDIES[level].score;
    if (this.score > this.best) {
      this.best = this.score;
      this.onBest?.(this.best);
    }
  }

  private checkOverflow(): void {
    let highest: number = BOTTLE.bottom;
    let overflowing = false;
    for (const { body, level, bornAt } of this.candies.values()) {
      if (this.elapsed - bornAt < RULES.freshCandyGrace) continue;
      const top = body.position.y - CANDIES[level].radius;
      highest = Math.min(highest, top);
      if (top < BOTTLE.warningY) overflowing = true;
    }
    this.overflowTime = overflowing ? this.overflowTime + RULES.fixedStep : 0;
    // Near-mouth warning ramps smoothly; a persistent overflow fills the last half.
    const proximity = Math.max(0, Math.min(1, (BOTTLE.warningY + 85 - highest) / 85));
    this.danger = Math.max(proximity * 0.5, this.overflowTime / RULES.overflowDelay);
    if (this.overflowTime + 1e-9 >= RULES.overflowDelay) {
      this.danger = 1;
      this.state = 'over';
      this.accumulator = 0;
    }
  }

  private createCandy(level: number, x: number, y: number, bornAt: number): Candy {
    const body = Matter.Bodies.circle(x, y, CANDIES[level].radius, {
      label: `candy-${level}`,
      restitution: RULES.restitution,
      friction: RULES.friction,
      frictionStatic: RULES.frictionStatic,
      frictionAir: RULES.frictionAir,
      slop: 0.015,
      sleepThreshold: 75,
    }, 32);
    const candy: Candy = { body, level, bornAt };
    this.candies.set(body.id, candy);
    Matter.Composite.add(this.engine.world, body);
    return candy;
  }

  private clampAim(): void {
    const radius = CANDIES[this.currentLevel].radius;
    this.aimX = Math.max(BOTTLE.left + radius + 1, Math.min(BOTTLE.right - radius - 1, Number.isFinite(this.aimX) ? this.aimX : (BOTTLE.left + BOTTLE.right) / 2));
  }

  private randomLevel(): number {
    // Mulberry32: predictable fixtures and replayable tuning, no global randomness.
    let value = this.randomState += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    let choice = ((value ^ value >>> 14) >>> 0) / 4294967296 * 100;
    for (let level = 0; level < RULES.spawnWeights.length; level++) {
      choice -= RULES.spawnWeights[level];
      if (choice < 0) return level;
    }
    return RULES.spawnWeights.length - 1;
  }
}
