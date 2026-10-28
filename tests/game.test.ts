import assert from 'node:assert/strict';
import test from 'node:test';
import Matter from 'matter-js';
import { BOTTLE, CANDIES, Game, RULES } from '../src/game';

type InternalFixture = {
  createCandy(level: number, x: number, y: number, bornAt: number): { body: Matter.Body };
};

function fixture(game: Game): InternalFixture {
  // Keep scenario setup out of the shipping public API.
  return game as unknown as InternalFixture;
}

function advance(game: Game, seconds: number): void {
  for (let step = 0; step < Math.round(seconds * 60); step++) game.update(1 / 60);
}

test('three simultaneous equal contacts consume each source only once', () => {
  const game = new Game(1);
  fixture(game).createCandy(0, 600, 400, 0);
  fixture(game).createCandy(0, 626, 400, 0);
  fixture(game).createCandy(0, 613, 423, 0);
  game.update(1 / 60);
  assert.deepEqual(game.bodies.map(body => body.level).sort(), [0, 1]);
  assert.equal(game.score, CANDIES[1].score);
  assert.equal(game.effects.length, 1);
  game.dispose();
});

test('two independent merges chain on a later simulation step and update best once per result', () => {
  const game = new Game(2);
  const bests: number[] = [];
  game.onBest = score => bests.push(score);
  for (const [x, y] of [[600, 400], [625, 400], [600, 427], [625, 427]]) {
    fixture(game).createCandy(0, x, y, 0);
  }
  game.update(1 / 60);
  assert.equal(game.bodies.length, 2);
  assert.equal(game.score, CANDIES[1].score * 2);
  game.update(1 / 60);
  assert.equal(game.bodies.length, 1);
  assert.equal(game.bodies[0].level, 2);
  assert.equal(game.score, CANDIES[1].score * 2 + CANDIES[2].score);
  assert.deepEqual(bests, [2, 4, 8]);
  game.dispose();
});

test('max-level contact stays intact; differing levels never merge', () => {
  const game = new Game(3);
  fixture(game).createCandy(10, 550, 460, 0);
  fixture(game).createCandy(10, 710, 460, 0);
  fixture(game).createCandy(0, 610, 260, 0);
  fixture(game).createCandy(1, 636, 260, 0);
  advance(game, 0.5);
  assert.equal(game.bodies.length, 4);
  assert.equal(game.score, 0);
  game.dispose();
});

test('a naturally sleeping candy falls when the candy supporting it merges', () => {
  const game = new Game(1);
  fixture(game).createCandy(2, 600, BOTTLE.bottom - CANDIES[2].radius, 0);
  const { body: upper } = fixture(game).createCandy(8, 600, 432, 0);
  advance(game, 8);
  assert.equal(upper.isSleeping, true, 'the resting stack must naturally enter sleep');
  const restingY = upper.position.y;

  // A matching candy arrives from the side. The support merges and shifts
  // sideways, so the upper candy must roll/fall without another incoming hit.
  fixture(game).createCandy(2, 651, BOTTLE.bottom - CANDIES[2].radius, 0);
  advance(game, 3);
  assert.equal(game.score, CANDIES[3].score);
  assert.ok(upper.position.y > restingY + 20,
    `lost support must wake gravity: y stayed ${upper.position.y} after resting at ${restingY}`);
  assert.ok(upper.position.y + CANDIES[8].radius <= BOTTLE.bottom + 1);
  game.dispose();
});

test('support merges also wake sleeping candies further up the stack', () => {
  const game = new Game(1);
  fixture(game).createCandy(2, 600, BOTTLE.bottom - CANDIES[2].radius, 0);
  const { body: middle } = fixture(game).createCandy(8, 600, 432, 0);
  const { body: top } = fixture(game).createCandy(5, 600, 314, 0);
  advance(game, 8);
  assert.ok(middle.isSleeping && top.isSleeping, 'the whole resting stack enters sleep');
  const middleY = middle.position.y, topY = top.position.y;

  fixture(game).createCandy(2, 651, BOTTLE.bottom - CANDIES[2].radius, 0);
  advance(game, 3);
  assert.equal(game.score, CANDIES[3].score);
  assert.ok(middle.position.y > middleY + 20, 'the directly supported candy falls');
  assert.ok(top.position.y > topY + 20, 'indirectly supported candy also falls without a fresh hit');
  game.dispose();
});

test('spawn grace and continuous overflow delay precede game over; final score freezes', () => {
  const game = new Game(4);
  const { body } = fixture(game).createCandy(0, 640, BOTTLE.warningY, 0);
  Matter.Body.setStatic(body, true);
  advance(game, RULES.freshCandyGrace + RULES.overflowDelay - 0.1);
  assert.equal(game.state, 'playing');
  advance(game, 0.2);
  assert.equal(game.state, 'over');
  assert.equal(game.danger, 1);
  assert.equal(game.drop(), false);
  const positions = game.bodies;
  game.update(2);
  assert.deepEqual(game.bodies, positions);
  game.dispose();
});

test('falling below warning resets overflow countdown', () => {
  const game = new Game(5);
  const { body } = fixture(game).createCandy(0, 640, BOTTLE.warningY, -2);
  Matter.Body.setStatic(body, true);
  advance(game, 1.5);
  Matter.Body.setPosition(body, { x: 640, y: 300 });
  game.update(1 / 60);
  Matter.Body.setPosition(body, { x: 640, y: BOTTLE.warningY });
  advance(game, 1.5);
  assert.equal(game.state, 'playing');
  game.dispose();
});

test('pause ignores elapsed time, blocks input, and resume keeps bounded steps', () => {
  const game = new Game(6);
  assert.equal(game.drop(), true);
  game.pause();
  const before = game.bodies;
  const aim = game.aimX;
  game.move(1, 1);
  game.update(600);
  assert.deepEqual(game.bodies, before);
  assert.equal(game.aimX, aim);
  assert.equal(game.drop(), false);
  game.resume();
  game.update(600);
  assert.equal(game.state, 'playing');
  assert.ok(game.bodies[0].y < 115, 'long stalls must not integrate hundreds of seconds');
  game.dispose();
});

test('fixed-step simulation matches 30 Hz and 60 Hz rendering', () => {
  const a = new Game(7);
  const b = new Game(7);
  a.drop();
  b.drop();
  for (let i = 0; i < 60; i++) a.update(1 / 60);
  for (let i = 0; i < 30; i++) b.update(1 / 30);
  const left = a.bodies[0];
  const right = b.bodies[0];
  assert.equal(left.level, right.level);
  assert.equal(left.x, right.x);
  assert.equal(left.y, right.y);
  assert.equal(left.angle, right.angle);
  a.dispose();
  b.dispose();
});

test('drop clamps by radius, cooldown blocks duplicates, restart clears physics and retains best', () => {
  const game = new Game(8);
  game.best = 100;
  game.aimX = -100;
  const level = game.currentLevel;
  assert.equal(game.drop(), true);
  assert.ok(game.bodies[0].x >= BOTTLE.left + CANDIES[level].radius);
  assert.equal(game.drop(), false);
  advance(game, 0.5);
  assert.equal(game.drop(), true);
  game.restart();
  assert.equal(game.state, 'playing');
  assert.equal(game.best, 100);
  assert.equal(game.score, 0);
  assert.equal(game.bodies.length, 0);
  assert.equal(game.effects.length, 0);
  assert.equal(game.danger, 0);
  assert.equal(game.dropCooldown, 0);
  assert.equal(game.drop(), true);
  game.dispose();
});

test('seeded dense playthroughs keep candies contained and reach a frozen result', () => {
  for (const seed of [17, 38, 91]) {
    const game = new Game(seed);
    let drops = 0;
    // Correctly waking supports permits denser packing; allow a longer game
    // while still requiring the complete overflow/frozen-result flow.
    for (; drops < 320 && game.state === 'playing'; drops++) {
      // Sweep through the whole mouth, including both clamped edge positions.
      game.aimX = BOTTLE.left + (drops * 73 % (BOTTLE.right - BOTTLE.left));
      assert.equal(game.drop(), true);
      advance(game, 0.5);
      for (const body of game.bodies) {
        assert.ok([body.x, body.y, body.angle].every(Number.isFinite));
        assert.ok(body.x - body.radius >= BOTTLE.left - 2, `seed ${seed}, drop ${drops}: left wall penetration ${JSON.stringify(body)}`);
        assert.ok(body.x + body.radius <= BOTTLE.right + 2, `seed ${seed}, drop ${drops}: right wall penetration ${JSON.stringify(body)}`);
        assert.ok(body.y + body.radius <= BOTTLE.bottom + 2, `seed ${seed}, drop ${drops}: floor penetration ${JSON.stringify(body)}`);
      }
    }
    assert.ok(game.score > 0, `seed ${seed} should exercise merges`);
    assert.equal(game.state, 'over', `seed ${seed} should eventually overflow`);
    assert.equal(game.drop(), false);
    const result = { score: game.score, bodies: game.bodies };
    advance(game, 2);
    assert.deepEqual({ score: game.score, bodies: game.bodies }, result);
    game.dispose();
  }
});
