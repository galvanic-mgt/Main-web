(() => {
  "use strict";

  const canvas = document.getElementById("galaxyCanvas");
  const hero = document.querySelector(".galaxy-hero");
  const stage = document.querySelector(".galaxy-stage");
  const scrollScene = document.querySelector(".galaxy-scroll");
  const heroContent = hero?.querySelector(".hero-inner");
  if (!canvas || !hero || !stage || !scrollScene) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: -1000, y: -1000, active: false };
  const colors = ["209,242,255", "112,201,233", "255,255,255", "58,182,199", "255,203,154"];
  const TAU = Math.PI * 2;
  const flowSlope = 0.22;
  let width = 0;
  let height = 0;
  let layout;
  let particles = [];
  let stars = [];
  let cloud;
  let raf = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let visible = true;
  let loaded = false;
  let burst = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let scrollProgress = 0;
  let targetProgress = 0;
  let scrollStart = 0;
  let scrollDistance = 1;

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };

  function measureScroll() {
    scrollScene.style.setProperty("--galaxy-height", `${height}px`);
    const bounds = scrollScene.getBoundingClientRect();
    // Short viewports can read the whole hero before the camera starts moving.
    const leadIn = Math.max(0, height - window.innerHeight);
    scrollStart = bounds.top + window.scrollY + leadIn;
    scrollDistance = Math.max(1, bounds.height - height - leadIn);
    updateScroll();
  }

  function updateScroll() {
    targetProgress = motion.matches ? 0 : clamp((window.scrollY - scrollStart) / scrollDistance);
  }

  // Pre-render soft star glows so the animation needs no per-star blur filters.
  const sprites = colors.map((color) => {
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 48;
    const context = sprite.getContext("2d");
    const glow = context.createRadialGradient(24, 24, 0, 24, 24, 24);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.09, `rgba(${color},0.95)`);
    glow.addColorStop(0.22, `rgba(${color},0.35)`);
    glow.addColorStop(0.5, `rgba(${color},0.07)`);
    glow.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = glow;
    context.fillRect(0, 0, 48, 48);
    return sprite;
  });

  const logo = new Image();

  function random(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function buildGalaxy() {
    const rand = random(20260905);
    const mask = document.createElement("canvas");
    mask.width = 420;
    // The upper 80% is the supplied symbol; the wordmark stays in the header.
    mask.height = Math.round(420 * (logo.naturalHeight * 0.8) / logo.naturalWidth);
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    maskCtx.drawImage(logo, 0, 0, logo.naturalWidth, logo.naturalHeight * 0.8, 0, 0, mask.width, mask.height);
    const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
      const i = (Math.floor(y) * mask.width + Math.floor(x)) * 4;
      return pixels[i + 3] > 100 && pixels[i + 1] > pixels[i] + 35 && pixels[i + 2] > pixels[i] + 30;
    };

    // Follow diagonal lanes through the actual logo mask. Stars fade at the
    // ends of each lane and recycle, keeping the silhouette intact as it flows.
    const lanes = [];
    for (let row = 0; row <= mask.height + mask.width * flowSlope; row += 1.5) {
      const segments = [];
      let start = -1;
      for (let x = 0; x <= mask.width; x++) {
        const hit = inside(x, row - x * flowSlope);
        if (hit && start < 0) start = x;
        if (!hit && start >= 0) {
          if (x - start >= 6) segments.push({ start, end: x, row });
          start = -1;
        }
      }
      lanes.push(segments);
    }

    particles = [];
    const count = width < 680 ? 3300 : 6500;
    for (let attempt = 0; particles.length < count && attempt < count * 80; attempt++) {
      const x = rand() * mask.width;
      const y = rand() * mask.height;
      if (!inside(x, y)) continue;
      const lane = lanes[Math.round((y + x * flowSlope) / 1.5)]?.find(segment => x >= segment.start && x < segment.end);
      if (!lane) continue;
      const edge = !inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3);
      const angle = Math.atan2(y - mask.height * 0.35, x - mask.width * 0.59);
      const radius = Math.hypot((x - mask.width * 0.59) * 0.8, y - mask.height * 0.35);
      const stream = Math.pow((Math.sin(radius * 0.15 - angle * 3) + 1) / 2, 7);
      if (rand() > (edge ? 0.9 : 0.13 + stream * 0.66)) continue;
      const bright = rand();
      particles.push({
        x: x / mask.width - 0.5,
        y: y / mask.height - 0.5,
        laneStart: lane.start / mask.width,
        laneLength: (lane.end - lane.start) / mask.width,
        laneRow: lane.row / mask.height,
        laneSlope: flowSlope * mask.width / mask.height,
        flowPhase: (x - lane.start) / (lane.end - lane.start),
        size: bright > 0.987 ? 17 + rand() * 15 : bright > 0.9 ? 6 + rand() * 6 : 1.7 + rand() * 4,
        alpha: 0.35 + rand() * 0.65,
        phase: rand() * TAU,
        depth: rand(),
        z: (rand() - 0.5) * 0.6,
        color: rand() < 0.055 ? 4 : Math.floor(rand() * 4),
        speed: 12 + rand() * 14,
      });
    }

    // A few soft clusters give the otherwise individual stars a nebular glow.
    cloud = document.createElement("canvas");
    cloud.width = mask.width * 2;
    cloud.height = mask.height * 2;
    const cloudCtx = cloud.getContext("2d");
    for (let i = 0; i < particles.length; i += 7) {
      const p = particles[i];
      cloudCtx.globalAlpha = 0.022;
      const size = 24 + p.depth * 40;
      cloudCtx.drawImage(sprites[1], (p.x + 0.5) * cloud.width - size / 2, (p.y + 0.5) * cloud.height - size / 2, size, size);
    }
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    const bounds = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    measureScroll();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const aspect = logo.naturalWidth / (logo.naturalHeight * 0.8);
    const w = Math.min(bounds.width, bounds.height * aspect, 930);
    layout = { x: bounds.left - rect.left + bounds.width / 2, y: bounds.top - rect.top + bounds.height / 2, w, h: w / aspect };
    const rand = random(411);
    stars = Array.from({ length: Math.round(Math.min(width * height / 1650, 950)) }, () => ({
      x: rand() * width, y: rand() * height, size: 0.5 + rand() * 1.4,
      phase: rand() * TAU, alpha: 0.1 + rand() * 0.55, depth: rand(),
    }));
    buildGalaxy();
    draw();
  }

  function draw() {
    if (!layout) return;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#03070b";
    ctx.fillRect(0, 0, width, height);

    const aura = ctx.createRadialGradient(layout.x, layout.y, 0, layout.x, layout.y, layout.w * 0.8);
    aura.addColorStop(0, "#0a1a24");
    aura.addColorStop(0.48, "#060e15");
    aura.addColorStop(1, "#03070b");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, width, height);

    const still = motion.matches;
    const travel = still ? 0 : smooth(0, 0.94, scrollProgress);
    const depart = smooth(0.64, 1, scrollProgress);
    const copyOpacity = 1 - smooth(0.015, 0.24, scrollProgress);
    hero.style.setProperty("--galaxy-copy-opacity", copyOpacity.toFixed(3));
    hero.style.setProperty("--galaxy-copy-y", `${-smooth(0, 0.3, scrollProgress) * 42}px`);
    if (heroContent && heroContent.inert !== (copyOpacity < 0.05)) {
      heroContent.inert = copyOpacity < 0.05;
    }
    const targetX = pointer.active && !still ? (pointer.x / width - 0.5) * 12 : 0;
    const targetY = pointer.active && !still ? (pointer.y / height - 0.5) * 10 : 0;
    parallaxX += (targetX - parallaxX) * 0.04;
    parallaxY += (targetY - parallaxY) * 0.04;

    for (const star of stars) {
      ctx.globalAlpha = star.alpha * (still ? 1 : 0.8 + Math.sin(elapsed * 0.45 + star.phase) * 0.2) * (1 - depart * 0.9);
      ctx.fillStyle = star.depth > 0.9 ? "#e6c6a6" : "#b4d7ea";
      const perspective = 1 + travel * (0.5 + star.depth * 2);
      const distance = still ? 0 : elapsed * (7 + star.depth * 15);
      const driftX = ((star.x + distance + 40) % (width + 80)) - 40;
      const driftY = (((star.y - distance * flowSlope + 40) % (height + 80) + height + 80) % (height + 80)) - 40;
      const x = width / 2 + (driftX - width / 2) * perspective + parallaxX * star.depth * 0.6;
      const y = height / 2 + (driftY - height / 2) * perspective + parallaxY * star.depth * 0.6;
      ctx.fillRect(x, y, star.size * (1 + travel * star.depth), star.size * (1 + travel * star.depth));
    }

    const formation = still ? 1 : Math.min(elapsed / 3.2, 1);
    const ease = 1 - Math.pow(1 - formation, 3);
    const scale = (1 + (1 - ease) * 0.3) * (1 + travel * 2.6);
    const angle = (1 - ease) * 0.4 + travel * 0.48;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = layout.x + parallaxX;
    const centerY = layout.y + parallaxY + (height * 0.48 - layout.y) * travel;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.8 * ease * (1 - travel);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.drawImage(cloud, -layout.w * scale / 2, -layout.h * scale / 2, layout.w * scale, layout.h * scale);
    ctx.restore();

    const starScale = Math.max(0.6, Math.min(1.25, layout.w / 680));
    for (const p of particles) {
      const flowSpeed = Math.min(p.speed, layout.w * p.laneLength / 2);
      const phase = still ? p.flowPhase : (p.flowPhase + elapsed * flowSpeed / (layout.w * p.laneLength)) % 1;
      const laneX = p.laneStart + phase * p.laneLength;
      const laneY = p.laneRow - laneX * p.laneSlope;
      const flowFade = still ? 1 : smooth(0, 0.12, phase) * (1 - smooth(0.88, 1, phase));
      const perspective = 1 / Math.max(0.16, 1 - travel * (0.65 + p.z));
      const px = (laneX - 0.5) * layout.w * perspective;
      const py = (laneY - 0.5) * layout.h * perspective;
      let x = centerX + (px * cos - py * sin) * scale;
      let y = centerY + (px * sin + py * cos) * scale * (1 - travel * 0.35);
      if (!still) {
        x += Math.cos(p.phase) * ((1 - ease) * p.depth * 150 + burst * p.depth * 75 + travel * travel * p.depth * width * 0.38);
        y += Math.sin(p.phase) * ((1 - ease) * p.depth * 150 + burst * p.depth * 75 + travel * travel * p.depth * height * 0.38);
        if (pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 105 && distance > 0) {
            const force = Math.pow(1 - distance / 105, 2) * 15;
            x += dx / distance * force;
            y += dy / distance * force;
          }
        }
      }
      if (x < -60 || x > width + 60 || y < -60 || y > height + 60) continue;
      const shimmer = still ? 1 : 0.76 + Math.sin(elapsed * 0.8 + p.phase) * 0.24;
      ctx.globalAlpha = p.alpha * shimmer * flowFade * (0.3 + ease * 0.7) * (1 - depart);
      const depthSize = starScale * Math.min(3.5, perspective * (1 + travel * 1.2));
      if (!still && p.size > 17) {
        const trail = Math.min(18, p.speed * 0.3 * depthSize);
        ctx.strokeStyle = `rgba(${colors[p.color]},0.24)`;
        ctx.lineWidth = Math.max(0.6, depthSize * 0.65);
        ctx.beginPath();
        ctx.moveTo(x - (cos + flowSlope * sin) * trail, y - (sin - flowSlope * cos) * trail);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      if (p.size < 6) {
        // Solid pinpoints keep the symbol crisp at phone sizes, without
        // spending a texture draw on each of the thousands of tiny stars.
        const size = Math.max(0.7, (0.65 + p.size * 0.09) * depthSize);
        ctx.fillStyle = `rgb(${colors[p.color]})`;
        if (size > 1.4) {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      } else {
        const size = p.size * depthSize;
        ctx.drawImage(sprites[p.color], x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // Arrive at the next section's exact background color before releasing
    // the pinned scene, so no rectangle or sudden color change is exposed.
    if (depart > 0) {
      ctx.fillStyle = `rgba(3,7,11,${depart})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || motion.matches) return;
    const delta = now - lastFrame;
    if (delta >= (width < 680 ? 1000 / 30 : 1000 / 45)) {
      updateScroll();
      elapsed += Math.min(delta / 1000, 0.05);
      scrollProgress += (targetProgress - scrollProgress) * (1 - Math.exp(-delta / 95));
      if (Math.abs(targetProgress - scrollProgress) < 0.0001) scrollProgress = targetProgress;
      burst *= Math.exp(-Math.min(delta / 1000, 0.05) * 2.8);
      lastFrame = now;
      draw();
    }
    raf = requestAnimationFrame(frame);
  }

  function syncAnimation() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!loaded) return;
    scrollScene.classList.toggle("is-scroll-enabled", !motion.matches);
    measureScroll();
    if (motion.matches) {
      scrollProgress = targetProgress = 0;
      burst = parallaxX = parallaxY = 0;
      draw();
    } else if (visible && !document.hidden) {
      scrollProgress = targetProgress;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  logo.onload = () => {
    try {
      resize();
      loaded = true;
      hero.classList.add("galaxy-ready");
      syncAnimation();
    } catch (error) {
      // The real logo remains visible if canvas sampling is unavailable.
      canvas.hidden = true;
    }
  };
  logo.onerror = () => { canvas.hidden = true; };

  const resizeObserver = new ResizeObserver(() => {
    if (loaded) resize();
  });
  resizeObserver.observe(hero);
  resizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  }, { threshold: 0 });
  visibilityObserver.observe(hero);
  document.addEventListener("visibilitychange", syncAnimation);
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", () => { if (loaded) measureScroll(); });
  motion.addEventListener("change", syncAnimation);
  hero.addEventListener("pointermove", (event) => {
    if (motion.matches || event.pointerType === "touch") return;
    const rect = hero.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { pointer.active = false; });
  hero.addEventListener("pointerdown", (event) => {
    if (!motion.matches && !event.target.closest("a, button")) burst = 1;
  }, { passive: true });
  logo.src = "assets/galvanic-logo.png";
})();
