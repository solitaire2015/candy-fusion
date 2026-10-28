import { Game, CANDIES, WIDTH, HEIGHT, BOTTLE } from './game';
import type { Platform } from './platform';
import { CANDY_ATLAS, CANDY_SPRITES } from './art';

type Hit = { id: string; x: number; y: number; w: number; h: number };
const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

export function startGame(platform: Platform) {
  const canvas = platform.canvas;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) throw new Error('当前设备无法创建 Canvas 2D 画布');
  const game = new Game();
  game.best = platform.loadBest();
  game.onBest = score => platform.saveBest(score);
  let dead = false, frame = 0, last = platform.now(), clock = 0;
  let scale = 1, ox = 0, oy = 0, sound = true, music = true, help = false;
  let musicPlaying: boolean | undefined;
  platform.setAudioEnabled(sound);
  platform.setMusicEnabled(music);
  let lastScore = 0, lastState = game.state;
  const held = new Map<number, string>();
  const keys = new Set<string>();
  const images: Record<string, any> = {};
  const imageReady: Record<string, boolean> = {};
  for (const [name, path] of [['world', 'assets/candy-world-v3.jpg'], ['candies', 'assets/candy-atlas-v3.png']]) {
    const image = platform.createImage();
    image.onload = () => { images[name] = image; imageReady[name] = true; };
    image.onerror = () => { imageReady[name] = false; };
    image.src = path;
  }
  let hits: Hit[] = [];
  function rect(x: number, y: number, w: number, h: number, r = 20) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  }
  function text(s: string, x: number, y: number, size: number, color = '#6b397a', weight = '600', align: CanvasTextAlign = 'left') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  function gradient(y: number, h: number, a: string, b: string) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, a); g.addColorStop(1, b); return g;
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.save(); ctx.shadowColor = '#8e439b24'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 7;
    rect(x, y, w, h, 25); ctx.fillStyle = gradient(y, h, '#fff8ffe8', '#ffdff0df'); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#ffffffd9'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function star(x: number, y: number, r: number, color: string, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const d = i % 2 ? r * .25 : r; if (!i) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function button(id: string, x: number, y: number, w: number, h: number, label: string, type = 'pink', small = false) {
    const directional = label === 'left' || label === 'right';
    const touchPadding = directional ? 8 : 0;
    hits.push({id, x: x - touchPadding, y: y - touchPadding, w: w + touchPadding * 2, h: h + touchPadding * 2});
    const pressed = [...held.values()].includes(id);
    const dy = pressed ? 5 : 0;
    ctx.save();
    rect(x, y + 6, w, h, small ? 18 : 23); ctx.fillStyle = type === 'yellow' ? '#bb7b3d' : '#7d4ba4'; ctx.fill();
    rect(x, y + dy, w, h - 2, small ? 18 : 23);
    ctx.fillStyle = type === 'yellow' ? gradient(y, h, '#fff9bd', '#ffd164') : gradient(y, h, '#e5b9ff', '#a877e7');
    if (type === 'white') ctx.fillStyle = gradient(y, h, '#fffaff', '#f9dcee');
    ctx.fill(); ctx.strokeStyle = '#ffffffe5'; ctx.lineWidth = 2.5; ctx.stroke();
    rect(x + 8, y + dy + 5, w - 16, Math.min(18, h * .35), 12); ctx.fillStyle = '#ffffff4a'; ctx.fill();
    if (directional) {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2 + dy); if (label === 'left') ctx.rotate(Math.PI);
      ctx.scale(1.35, 1.35);
      ctx.beginPath(); ctx.moveTo(-8, -13); ctx.quadraticCurveTo(-12, -15, -12, -9); ctx.lineTo(-12, 9); ctx.quadraticCurveTo(-12, 15, -7, 12); ctx.lineTo(11, 3); ctx.quadraticCurveTo(16, 0, 11, -3); ctx.closePath(); ctx.fillStyle = '#fffdf2'; ctx.fill(); ctx.strokeStyle = '#c58a48'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    } else {
      const ink = type === 'white' || type === 'yellow' ? '#85516e' : '#fffaff';
      text(label, x + w / 2, y + h / 2 + dy, small ? (label.length > 2 ? 15 : 21) : 27, ink, '800', 'center');
    }
    ctx.restore();
  }
  function candy(level: number, x: number, y: number, r: number, angle = 0, alpha = 1) {
    const item = CANDIES[level];
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(angle);
    if (imageReady.candies) {
      const atlas = images.candies;
      const box = CANDY_SPRITES[level];
      const sx = atlas.width / CANDY_ATLAS.width, sy = atlas.height / CANDY_ATLAS.height;
      const dw = 2 * r * box.w / box.visibleW, dh = 2 * r * box.h / box.visibleH;
      ctx.drawImage(atlas, box.x * sx, box.y * sy, box.w * sx, box.h * sy, -dw / 2, -dh / 2, dw, dh);
    } else {
      const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
      g.addColorStop(0, '#fffde6'); g.addColorStop(.25, item.color); g.addColorStop(.8, item.color); g.addColorStop(1, '#ffffff');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = Math.max(2, r * .075); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * .76, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff90'; ctx.lineWidth = r * .05; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-r * .28, -r * .39, r * .36, r * .15, -.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffffbd'; ctx.fill();
      text(['樱', '莓', '葡', '柠', '橙', '苹', '梨', '桃', '菠', '瓜', '夏'][level], 0, r * .08, r * .7, '#ffffff', '800', 'center');
    }
    ctx.restore();
  }
  function jarBack() {
    const {left, right, top, bottom} = BOTTLE; const w = right - left;
    ctx.save();
    ctx.shadowColor = '#7a419660'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 15;
    ctx.beginPath(); ctx.ellipse((left + right) / 2, bottom + 11, w / 2 + 8, 18, 0, 0, Math.PI * 2); ctx.fillStyle = '#7e3f8d32'; ctx.fill(); ctx.shadowColor = 'transparent';
    rect(left - 5, top, w + 10, bottom - top + 7, 31); ctx.fillStyle = gradient(top, bottom - top, '#d2c4ff3b', '#b8a0f84d'); ctx.fill();
    ctx.strokeStyle = '#fff6ffc9'; ctx.lineWidth = 3; ctx.stroke();
    const glow = ctx.createLinearGradient(left, 0, right, 0); glow.addColorStop(0, '#ffffff60'); glow.addColorStop(.08, '#ffffff0a'); glow.addColorStop(.82, '#ffffff0a'); glow.addColorStop(1, '#ffffff60');
    ctx.fillStyle = glow; ctx.fill();
    ctx.beginPath(); ctx.ellipse((left + right) / 2, bottom - 3, w / 2 - 1, 17, 0, 0, Math.PI * 2); ctx.fillStyle = '#a783df47'; ctx.fill(); ctx.strokeStyle = '#fff6ff90'; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.moveTo(left + 14, BOTTLE.warningY); ctx.lineTo(right - 14, BOTTLE.warningY); ctx.strokeStyle = game.danger > 0 ? '#f4568b' : '#d996bb65'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    if (game.danger > 0) text('快满啦！', 640, BOTTLE.warningY + 19, 14, '#bd3575', '700', 'center');
    ctx.restore();
  }
  function jarFront() {
    const {left, right, top, bottom} = BOTTLE;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#fffaffbf';
    ctx.beginPath(); ctx.moveTo(left + 7, top + 40); ctx.lineTo(left + 7, bottom - 37); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff7a'; ctx.beginPath(); ctx.moveTo(left + 17, top + 62); ctx.lineTo(left + 17, bottom - 56); ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff57'; ctx.beginPath(); ctx.moveTo(right - 9, top + 45); ctx.lineTo(right - 9, top + 139); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(640, top, (right - left) / 2 + 6, 15, 0, 0, Math.PI * 2); ctx.fillStyle = gradient(top - 15, 30, '#fdecffb8', '#d6aeef66'); ctx.fill(); ctx.strokeStyle = '#fff5ffff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(640, bottom + 3, (right - left) / 2 + 2, 17, 0, .08, Math.PI - .08); ctx.strokeStyle = '#fffaffdd'; ctx.lineWidth = 4; ctx.stroke();
    star(left + 4, top + 71, 8, '#fff'); star(right - 6, bottom - 40, 5, '#fff');
    ctx.restore();
  }
  function drawScene() {
    const v = platform.getViewport(); const dpr = Math.min(v.dpr || 1, 2);
    const pw = Math.round(v.width * dpr), ph = Math.round(v.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, v.width, v.height);
    ctx.fillStyle = '#e7cdf0'; ctx.fillRect(0, 0, v.width, v.height);
    const area = v.safeArea || {left: 0, top: 0, right: v.width, bottom: v.height};
    scale = Math.min((area.right - area.left) / WIDTH, (area.bottom - area.top) / HEIGHT);
    ox = area.left + (area.right - area.left - WIDTH * scale) / 2; oy = area.top + (area.bottom - area.top - HEIGHT * scale) / 2;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
    if (imageReady.world) ctx.drawImage(images.world, 0, 0, WIDTH, HEIGHT);
    else { ctx.fillStyle = gradient(0, HEIGHT, '#c7b6ec', '#f8bfd6'); ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    ctx.fillStyle = '#f9eaff12'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < 18; i++) {
      const x = (i * 137.7 + 23) % WIDTH, y = (i * 67.2 + Math.sin(clock * .3 + i) * 7) % HEIGHT;
      star(x, y, i % 3 + 2, '#ffffff90', clock * .06);
    }
    hits = [];
    text('C A N D Y  F U S I O N', 640, 17, 13, '#7d5c9a', '800', 'center');
    ctx.save(); ctx.shadowColor = '#cb73a34d'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 3;
    text('水果糖果合成', 640, 44, 26, '#fff7ff', '900', 'center'); ctx.restore();
    text('一罐甜蜜，无限惊喜', 97, 67, 16, '#855d9a', '600');
    button('help', 96, 23, 45, 32, '?', 'white', true);
    text('怎么玩', 152, 39, 14, '#855d9a');
    button('sound', 948, 31, 78, 35, sound ? '音效 开' : '音效 关', 'white', true);
    button('music', 1038, 31, 78, 35, music ? '音乐 开' : '音乐 关', 'white', true);
    button('pause', 1132, 31, 45, 35, 'Ⅱ', 'white', true);
    panel(96, 126, 272, 141);
    text('本 局 得 分', 119, 151, 14, '#a075a2', '700');
    text(String(game.score).padStart(3, '0'), 232, 199, 49, '#ad5488', '900', 'center');
    ctx.fillStyle = '#d99cbd50'; ctx.fillRect(116, 230, 232, 1);
    text('最高纪录', 118, 248, 13, '#9b7496'); text(String(game.best), 345, 248, 17, '#ad5488', '800', 'right');
    panel(96, 287, 272, 180);
    text('甜 蜜 进 化', 118, 313, 15, '#9a6499', '800'); text('相同糖果碰一碰，就会长大', 118, 338, 12, '#9f829e', '500');
    for (let i = 0; i < CANDIES.length; i++) {
      const row = i < 6 ? 0 : 1; const j = row ? i - 6 : i;
      const x = 124 + j * 43 + (row ? 21 : 0); const y = 377 + row * 52;
      candy(i, x, y, i === 10 ? 20 : 16 + i * .25);
      text(String(i + 1).padStart(2, '0'), x, y + 25, 9, '#a880a2', '700', 'center');
    }
    button('left', 70, 488, 148, 92, 'left', 'yellow'); button('right', 238, 488, 148, 92, 'right', 'yellow');
    text('按住左右，选择落点', 228, 607, 13, '#8b6298', '500', 'center');
    panel(914, 126, 264, 176); text('下一颗糖果', 1046, 154, 16, '#936195', '800', 'center');
    ctx.beginPath(); ctx.arc(1046, 225, 47, 0, Math.PI * 2); ctx.fillStyle = '#fff9ff7a'; ctx.fill();
    candy(game.nextLevel, 1046, 225, 34);
    panel(914, 324, 264, 128);
    text('碰一碰，甜蜜升级', 1046, 350, 18, '#925e93', '800', 'center');
    text('调整落点，再让糖果落下', 1046, 381, 13, '#a07c9e', '500', 'center');
    text('合成西瓜，装下一整个夏天', 1046, 405, 13, '#a07c9e', '500', 'center');
    star(1046, 432, 5, '#ce92bb');
    button('drop', 914, 484, 264, 80, '掉 落', 'pink');
    if (game.dropCooldown > 0) {
      ctx.fillStyle = '#ffffff60'; rect(927, 550, 238 * Math.min(1, game.dropCooldown / .45), 3, 2); ctx.fill();
    }
    text('轻点掉落，收集你的下一份甜蜜', 1046, 593, 12, '#8b6298', '500', 'center');
    jarBack();
    if (game.state === 'playing') {
      const r = CANDIES[game.currentLevel].radius;
      let targetY = BOTTLE.bottom - r;
      for (const b of game.bodies) {
        const dx = b.x - game.aimX, reach = b.radius + r;
        if (Math.abs(dx) < reach) targetY = Math.min(targetY, b.y - Math.sqrt(reach * reach - dx * dx));
      }
      ctx.save(); ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(game.aimX, BOTTLE.top + 17); ctx.lineTo(game.aimX, Math.max(BOTTLE.top + 20, targetY)); ctx.strokeStyle = '#fff9ff90'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(game.aimX, Math.max(BOTTLE.top + 20, targetY), Math.max(10, r * .7), 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff9ff50'; ctx.fill(); ctx.restore();
    }
    for (const b of game.bodies) candy(b.level, b.x, b.y, b.radius, b.angle);
    for (const e of game.effects) {
      const t = Math.min(1, e.age / .65), radius = CANDIES[e.level].radius;
      ctx.save(); ctx.globalAlpha = 1 - t;
      ctx.beginPath(); ctx.arc(e.x, e.y, radius * (.8 + t), 0, Math.PI * 2); ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = 3 * (1 - t); ctx.stroke();
      for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7; star(e.x + Math.cos(a) * (radius + t * 45), e.y + Math.sin(a) * (radius + t * 45), 6 * (1 - t), k % 2 ? '#fff8ca' : '#fff', a + t); }
      text(`+${CANDIES[e.level].score}`, e.x, e.y - radius - 12 - t * 30, 19, '#fff9dc', '800', 'center'); ctx.restore();
    }
    jarFront();
    if (game.state === 'playing') candy(game.currentLevel, game.aimX, BOTTLE.spawnY, CANDIES[game.currentLevel].radius, Math.sin(clock * 2) * .04);
    text(platform.name === 'web' ? '左右键 / A D 移动 · 空格掉落 · P 暂停' : '相同糖果相遇，甜蜜就会长大', 640, 611, 11, '#876595', '500', 'center');
    if (game.state !== 'playing' || help) drawOverlay();
    if (v.height > v.width) {
      ctx.fillStyle = '#633777ed'; rect(360, 255, 560, 92, 24); ctx.fill(); text('横过手机，装下一罐甜蜜', 640, 301, 27, '#fff4fa', '700', 'center');
      hits = [];
    }
    ctx.restore();
  }
  function drawOverlay() {
    hits = [];
    ctx.fillStyle = '#38234c88'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    panel(422, 145, 436, 365);
    star(475, 183, 13, '#e3a159'); star(808, 187, 11, '#d690b8');
    const over = game.state === 'over';
    text(help ? '一起来收集甜蜜' : over ? '甜蜜已装满！' : '休息一小会儿', 640, 198, 29, '#955482', '900', 'center');
    if (help) {
      text('① 按住左右按钮，调整落点', 640, 257, 18, '#987296', '600', 'center');
      text('② 点击掉落，相同糖果会合成', 640, 293, 18, '#987296', '600', 'center');
      text('③ 糖果持续超过虚线，就结束啦', 640, 329, 18, '#987296', '600', 'center');
      text('试着合出最大颗的西瓜吧', 640, 365, 16, '#ba8aaa', '500', 'center');
      button('resume', 492, 415, 296, 57, '开始收集', 'pink');
    } else {
      text(over ? '本局收获' : '你的糖果会乖乖等你', 640, 253, 16, '#a379a0', '600', 'center');
      text(String(game.score), 640, 304, 58, '#b4578e', '900', 'center');
      text(`最高纪录  ${game.best}`, 640, 354, 16, '#a379a0', '600', 'center');
      button(over ? 'restart' : 'resume', 478, 394, 324, 57, over ? '再装一罐' : '继续游戏', 'pink');
      if (!over) { hits.push({id: 'restart', x: 530, y: 465, w: 220, h: 28}); text('重新开始', 640, 479, 14, '#a57b9c', '600', 'center'); }
    }
  }
  function play(kind: 'drop' | 'merge' | 'over') { if (sound) platform.playSound(kind); }
  function syncMusic() {
    const playing = game.state === 'playing' && !help;
    if (playing !== musicPlaying) { musicPlaying = playing; platform.setMusicPlaying(playing); }
  }
  function clearInput() { held.clear(); keys.clear(); }
  function activate(id: string) {
    if (id === 'sound') { sound = !sound; platform.setAudioEnabled(sound); if (sound) play('drop'); return; }
    if (id === 'music') { music = !music; platform.setMusicEnabled(music); return; }
    if (id === 'pause') { game.pause(); clearInput(); syncMusic(); return; }
    if (id === 'help') { help = true; game.pause(); clearInput(); syncMusic(); return; }
    if (id === 'resume') { help = false; game.resume(); clearInput(); syncMusic(); return; }
    if (id === 'restart') { help = false; game.restart(); clearInput(); lastScore = 0; syncMusic(); return; }
    if (id === 'drop' && game.drop()) { play('drop'); }
  }
  const unPointer = platform.onPointer((type, id, x, y) => {
    const viewport = platform.getViewport();
    if (viewport.height > viewport.width) { clearInput(); return; }
    if (type === 'down') platform.unlockAudio();
    const px = (x - ox) / scale, py = (y - oy) / scale;
    if (type === 'up' || type === 'cancel') { held.delete(id); return; }
    if (type === 'move') {
      const previous = held.get(id);
      if (previous === 'left' || previous === 'right') {
        const hit = hits.find(h => h.id === previous);
        if (!hit || px < hit.x - 20 || px > hit.x + hit.w + 20 || py < hit.y - 30 || py > hit.y + hit.h + 30) held.delete(id);
      }
      return;
    }
    const hit = hits.find(h => px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h);
    if (hit) { held.set(id, hit.id); activate(hit.id); }
  });
  const unKey = platform.onKey((key, down) => {
    const viewport = platform.getViewport();
    if (viewport.height > viewport.width) { clearInput(); return; }
    const k = key.toLowerCase();
    if (!down) { keys.delete(k); return; }
    if (keys.has(k)) return;
    platform.unlockAudio();
    keys.add(k);
    if (k === 'p' || k === 'escape') { if (game.state === 'paused') activate('resume'); else if (game.state === 'playing') activate('pause'); }
    if (k === ' ' || k === 'enter') activate(game.state === 'over' ? 'restart' : game.state === 'paused' ? 'resume' : 'drop');
    if (k === 'r') activate('restart');
  });
  const unVisibility = platform.onVisibility(visible => { clearInput(); if (!visible) game.pause(); syncMusic(); last = platform.now(); });
  function loop(time: number) {
    if (dead) return;
    const dt = Math.min(.1, Math.max(0, (time - last) / 1000)); last = time; clock += dt;
    const viewport = platform.getViewport();
    if (viewport.height > viewport.width) { game.pause(); clearInput(); }
    if (game.state === 'playing') {
      const values = [...held.values()];
      const direction = Number(values.includes('right') || keys.has('arrowright') || keys.has('d')) - Number(values.includes('left') || keys.has('arrowleft') || keys.has('a'));
      game.move(direction, dt); game.update(dt);
    }
    if (game.score > lastScore) { play('merge'); platform.vibrate(); }
    if (game.state === 'over' && lastState !== 'over') { play('over'); clearInput(); }
    syncMusic();
    lastScore = game.score; lastState = game.state;
    drawScene(); frame = platform.requestFrame(loop);
  }
  syncMusic(); drawScene(); frame = platform.requestFrame(loop);
  return {game, dispose() { dead = true; platform.cancelFrame(frame); unPointer(); unKey(); unVisibility(); game.dispose(); }};
}
