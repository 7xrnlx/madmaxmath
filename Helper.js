// Screen Link helper: runs on the computer that is SHARING its screen.
// It receives mouse/keyboard events from your Screen Link page and performs them for real.
//
// Usage:  node helper.js https://YOURNAME.github.io
// (the argument is the origin of your GitHub Pages site: no path, no trailing slash)

const { WebSocketServer } = require('ws');
const { mouse, keyboard, screen, Point, Button, Key } = require('@nut-tree-fork/nut-js');

const PORT = 8787;
const allowed = process.argv.slice(2).map(s => s.replace(/\/+$/, ''));

if (allowed.length === 0) {
  console.error('Missing your site address.\nExample: node helper.js https://yourname.github.io');
  process.exit(1);
}

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

let W = 1920, H = 1080;
screen.width().then(w => (W = w));
screen.height().then(h => (H = h));

const KEYS = {
  Enter: Key.Enter, Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape,
  ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
  Delete: Key.Delete, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown,
  ' ': Key.Space,
};
const BUTTONS = [Button.LEFT, Button.MIDDLE, Button.RIGHT];

async function handle(d) {
  if (d.k !== 'key') {
    const x = Math.min(W - 1, Math.max(0, Math.round(d.x * (W - 1))));
    const y = Math.min(H - 1, Math.max(0, Math.round(d.y * (H - 1))));
    await mouse.setPosition(new Point(x, y));
  }
  switch (d.k) {
    case 'down':  await mouse.pressButton(BUTTONS[d.b] ?? Button.LEFT); break;
    case 'up':    await mouse.releaseButton(BUTTONS[d.b] ?? Button.LEFT); break;
    case 'wheel': {
      const steps = Math.max(1, Math.round(Math.abs(d.dy) / 40));
      if (d.dy > 0) await mouse.scrollDown(steps); else await mouse.scrollUp(steps);
      break;
    }
    case 'key':
      if (KEYS[d.key]) await keyboard.type(KEYS[d.key]);
      else if (typeof d.key === 'string' && d.key.length === 1) await keyboard.type(d.key);
      break;
  }
}

// Run events in order, but drop stale mouse-move events so the cursor never lags behind
const queue = [];
let busy = false;
function enqueue(d) {
  const last = queue[queue.length - 1];
  if (d.k === 'move' && last && last.k === 'move') queue[queue.length - 1] = d;
  else queue.push(d);
  if (!busy) run();
}
async function run() {
  busy = true;
  while (queue.length) {
    try { await handle(queue.shift()); } catch (e) { console.error('Action failed:', e.message); }
  }
  busy = false;
}

const wss = new WebSocketServer({
  host: '127.0.0.1',
  port: PORT,
  // Only your own site may talk to this helper; browsers can't fake the Origin header
  verifyClient: ({ origin }) => allowed.includes(origin),
});

wss.on('connection', ws => {
  console.log('Screen Link connected. Remote control is ON.');
  ws.on('message', msg => {
    try {
      const d = JSON.parse(msg.toString());
      if (d && d.t === 'input') enqueue(d);
    } catch (e) {}
  });
  ws.on('close', () => console.log('Screen Link disconnected. Remote control is OFF.'));
});

console.log(`Helper listening on 127.0.0.1:${PORT}`);
console.log(`Allowed site(s): ${allowed.join(', ')}`);
console.log('Leave this window open while sharing. Press Ctrl+C to stop.');
