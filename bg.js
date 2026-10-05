// Animated background: slowly drifting vertices joined to their near neighbours.
// Edges fade with length; triangles whose three edges are all present get a faint fill.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const AREA_PER_POINT = 11000; // px^2 of viewport per vertex (lower = denser)
  const MAX_POINTS = 140;
  const LINK_DIST = 150;        // px; vertices closer than this are connected
  const SPEED = 0.12;           // px per frame at 60 fps
  const MARGIN = LINK_DIST;     // vertices roam slightly past the viewport edges

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)');

  let w = 0, h = 0, dpr = 1;
  let points = [];
  let rgb = '26, 95, 180';
  let lineAlpha = 0.22, fillAlpha = 0.05;

  function readColor() {
    // Use the page accent colour so the mesh follows light/dark themes.
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = /^#([0-9a-f]{6})$/i.exec(accent);
    if (m) {
      const n = parseInt(m[1], 16);
      rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    }
    lineAlpha = darkMode.matches ? 0.18 : 0.22;
    fillAlpha = darkMode.matches ? 0.04 : 0.05;
  }

  function makePoint() {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * (w + 2 * MARGIN) - MARGIN,
      y: Math.random() * (h + 2 * MARGIN) - MARGIN,
      angle,
      turn: (Math.random() - 0.5) * 0.004, // slow wander in heading
      speed: SPEED * (0.5 + Math.random()),
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.min(MAX_POINTS, Math.round(((w + 2 * MARGIN) * (h + 2 * MARGIN)) / AREA_PER_POINT));
    while (points.length < target) points.push(makePoint());
    points.length = target;
  }

  function step(dt) {
    for (const p of points) {
      p.turn += (Math.random() - 0.5) * 0.0006;
      p.turn = Math.max(-0.006, Math.min(0.006, p.turn));
      p.angle += p.turn * dt;
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;

      // Bounce softly off the padded bounds.
      if (p.x < -MARGIN || p.x > w + MARGIN) {
        p.angle = Math.PI - p.angle;
        p.x = Math.max(-MARGIN, Math.min(w + MARGIN, p.x));
      }
      if (p.y < -MARGIN || p.y > h + MARGIN) {
        p.angle = -p.angle;
        p.y = Math.max(-MARGIN, Math.min(h + MARGIN, p.y));
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const n = points.length;
    const maxD2 = LINK_DIST * LINK_DIST;

    // strength[i][j] in (0, 1]: 1 when touching, 0 at LINK_DIST.
    const adj = new Array(n);
    for (let i = 0; i < n; i++) adj[i] = new Map();
    for (let i = 0; i < n; i++) {
      const a = points[i];
      for (let j = i + 1; j < n; j++) {
        const b = points[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxD2) {
          const s = 1 - Math.sqrt(d2) / LINK_DIST;
          adj[i].set(j, s);
          adj[j].set(i, s);
        }
      }
    }

    // Faint triangle fills.
    for (let i = 0; i < n; i++) {
      for (const [j, sij] of adj[i]) {
        if (j <= i) continue;
        for (const [k, sik] of adj[i]) {
          if (k <= j) continue;
          const sjk = adj[j].get(k);
          if (sjk === undefined) continue;
          const s = Math.min(sij, sik, sjk);
          ctx.fillStyle = `rgba(${rgb}, ${fillAlpha * s})`;
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.lineTo(points[k].x, points[k].y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Edges.
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      for (const [j, s] of adj[i]) {
        if (j <= i) continue;
        ctx.strokeStyle = `rgba(${rgb}, ${lineAlpha * s})`;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }

    // Vertices.
    ctx.fillStyle = `rgba(${rgb}, ${lineAlpha * 1.5})`;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let last = 0, running = false;
  function frame(t) {
    const dt = last ? Math.min((t - last) / (1000 / 60), 3) : 1;
    last = t;
    step(dt);
    draw();
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    if (reduceMotion.matches) {
      running = false;
      draw(); // static mesh only
      return;
    }
    if (!running) {
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }
  }

  readColor();
  resize();
  start();

  window.addEventListener('resize', () => { resize(); if (!running) draw(); });
  darkMode.addEventListener('change', () => { readColor(); if (!running) draw(); });
  reduceMotion.addEventListener('change', start);
})();
