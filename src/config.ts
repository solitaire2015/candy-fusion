/** Logical pixels; both browser and WeChat scale this world without stretching it. */
export const WIDTH = 1280;
export const HEIGHT = 640;

export const BOTTLE = {
  left: 450,
  right: 830,
  top: 108,
  bottom: 555,
  warningY: 145,
  spawnY: 86,
} as const;

export interface CandyDefinition {
  level: number;
  name: string;
  radius: number;
  color: string;
  /** Points awarded when this level is created by merging. */
  score: number;
}

/** Small difficulty increase: 5% wider candies occupy about 10% more area. */
export const CANDY_SIZE_SCALE = 1.05;

/** Original progression. All values are prototype tuning, not measured reference rules. */
export const CANDIES: readonly CandyDefinition[] = [
  { level: 0, name: '樱桃', radius: 15, color: '#c45b86', score: 0 },
  { level: 1, name: '草莓', radius: 20, color: '#f4a195', score: 2 },
  { level: 2, name: '葡萄', radius: 26, color: '#bd95dd', score: 4 },
  { level: 3, name: '柠檬', radius: 32, color: '#ffe6a1', score: 8 },
  { level: 4, name: '蜜橘', radius: 39, color: '#ffc184', score: 16 },
  { level: 5, name: '苹果', radius: 47, color: '#f6c5b4', score: 32 },
  { level: 6, name: '青梨', radius: 55, color: '#d5e9a1', score: 64 },
  { level: 7, name: '蜜桃', radius: 63, color: '#f8cbd0', score: 128 },
  { level: 8, name: '菠萝', radius: 71, color: '#f9e8a4', score: 256 },
  { level: 9, name: '哈密瓜', radius: 79, color: '#c4e8b2', score: 512 },
  { level: 10, name: '西瓜', radius: 87, color: '#a9d5a9', score: 1024 },
].map(candy => ({ ...candy, radius: candy.radius * CANDY_SIZE_SCALE }));

export const RULES = {
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxSteps: 6,
  dropCooldown: 0.45,
  aimSpeed: 290,
  freshCandyGrace: 1.2,
  overflowDelay: 2,
  effectDuration: 0.75,
  /** Relative weights for levels 0–3. */
  spawnWeights: [40, 30, 20, 10],
  gravity: 1.25,
  restitution: 0.18,
  friction: 0.16,
  frictionStatic: 0.45,
  frictionAir: 0.007,
  maxSpeed: 16,
} as const;
