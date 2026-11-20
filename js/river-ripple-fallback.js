/* A 2D reflection-displacement fallback for browsers without float WebGL textures. */
(function () {
  window.createRiverRippleFallback = function (hero, texture, signal) {
    const surface = document.createElement('canvas');
    const context = surface.getContext('2d');
    const sample = document.createElement('canvas');
    const sampler = sample.getContext('2d', {willReadFrequently: true});
    if (!context || !sampler) return null;

    surface.className = 'dpnco-ripple-fallback';
    surface.setAttribute('aria-hidden', 'true');
    hero.appendChild(surface);
    const projectionY = Math.SQRT1_2;
    const waves = [];
    let input, output, frame = 0, lastMove = -Infinity, rim = 1;

    function setReflection(strength) {
      rim = strength;
      const scale = Math.min(1, 640 / Math.max(texture.width, texture.height));
      const width = Math.max(1, Math.round(texture.width * scale));
      const height = Math.max(1, Math.round(texture.height * scale));
      if (surface.width !== width || surface.height !== height || !output) {
        surface.width = sample.width = width;
        surface.height = sample.height = height;
        output = context.createImageData(width, height);
      }
      sampler.drawImage(texture, 0, 0, width, height);
      input = sampler.getImageData(0, 0, width, height).data;
    }

    function render(now) {
      const width = surface.width, height = surface.height;
      const pixels = output.data;
      pixels.fill(0);
      for (let i = waves.length - 1; i >= 0; i--) {
        if (now - waves[i].time >= waves[i].lifetime) waves.splice(i, 1);
      }
      const desktop = hero.clientWidth >= 1024;
      for (const wave of waves) {
        const age = Math.max(0, (now - wave.time) / wave.lifetime);
        const expansion = wave.rain ? 1 - (1 - age) * (1 - age) : age;
        const fadeProgress = Math.max(0, (age - .55) / .45);
        const fade = wave.rain ? (1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress)) / (1 + age) : 1 - age;
        const centerX = wave.x * width, centerY = wave.y * height;
        const outer = 2 + expansion * wave.reach;
        const softCrest = desktop && wave.rain;
        const band = softCrest ? 12 : 21;
        const trailing = outer + 3 - band;
        const limit = outer + 3;
        const left = Math.max(0, Math.floor(centerX - limit));
        const right = Math.min(width - 1, Math.ceil(centerX + limit));
        const top = Math.max(0, Math.floor(centerY - limit * projectionY));
        const bottom = Math.min(height - 1, Math.ceil(centerY + limit * projectionY));
        for (let y = top; y <= bottom; y++) {
          const dy = (y - centerY) / projectionY;
          for (let x = left; x <= right; x++) {
            const dx = x - centerX;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < Math.max(1, trailing) || distance > limit) continue;
            const phase = (outer - distance) / band;
            const envelope = Math.sin(Math.PI * (phase + 3 / band));
            const amplitude = envelope * fade * wave.strength;
            const slope = Math.sin(phase * Math.PI * 7) * amplitude * wave.contribution * (softCrest ? -.7 : 1);
            const normalX = dx / distance, normalY = dy / distance;
            const sx = Math.max(0, Math.min(width - 1, Math.round(x + normalX * slope * 3)));
            const sy = Math.max(0, Math.min(height - 1, Math.round(y + normalY * slope * 3 * projectionY)));
            const target = (y * width + x) * 4, source = (sy * width + sx) * 4;
            const light = (-normalX * .36 + normalY * .92) * slope * (8 + 55 * rim);
            const alpha = Math.min(215, Math.abs(slope) * (110 + 95 * rim));
            if (alpha < pixels[target + 3]) continue;
            pixels[target] = input[source] + light;
            pixels[target + 1] = input[source + 1] + light;
            pixels[target + 2] = input[source + 2] + light;
            pixels[target + 3] = alpha;
          }
        }
      }
      context.putImageData(output, 0, 0);
      frame = waves.length ? requestAnimationFrame(render) : 0;
    }

    function drop(x, y, strength, rain = false, contribution = 1) {
      if (!input || signal.aborted || x < 0 || x > 1 || y < 0 || y > 1) return;
      const reach = Math.min(surface.width, surface.height) * (.11 + .05 * strength) * (rain ? 1.65 : 1);
      waves.push({x, y, strength, reach, rain, contribution, lifetime: rain ? 1500 : 1150, time: performance.now()});
      if (waves.length > 32) waves.shift();
      if (!frame) frame = requestAnimationFrame(render);
    }

    function point(event, strength, contribution = 1) {
      if (event.target.closest('.dpnco-river-contact')) return;
      const rect = hero.getBoundingClientRect();
      drop((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, strength, false, contribution);
    }
    hero.addEventListener('pointerdown', function (event) {
      const mouse = event.pointerType === 'mouse';
      point(event, mouse ? .86 : 1, mouse ? Math.sqrt(.8) : 1);
    }, {passive: true, signal});
    hero.addEventListener('pointermove', function (event) {
      if (event.pointerType !== 'mouse' || performance.now() - lastMove < 55) return;
      lastMove = performance.now();
      point(event, .43);
    }, {passive: true, signal});
    signal.addEventListener('abort', function () {
      if (frame) cancelAnimationFrame(frame);
      surface.remove();
    }, {once: true});
    return {dropRain: (x, y) => drop(x, y, .91, true), setReflection};
  };
})();
