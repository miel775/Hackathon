<script lang="ts">
  import { onMount } from "svelte";

  type CardConfig = { id: string; title: string; subtitle: string };
  type CardState = CardConfig & {
    x: number;
    y: number;
    scale: number;
    opacity: number;
    hidden: boolean;
    hovered: boolean;
  };

  const animationConfig = {
    blackHole: {
      radius: 44,
      absorbRadius: 30,
      gravity: 0.24,
    },
    render: {
      glowRadiusMultiplier: 2.6,
      glowInnerRadiusMultiplier: 0.35,
      accretionRingWidth: 1,
      accretionRingRadiusMultiplier: 1.55,
      accretionStartSpeed: 0.001,
      accretionSweepAngle: 1.3,
    },
    orbitLayout: {
      baseSlotsPerRing: 6,
      minViewportSide: 200,
      minOrbitRadius: 90,
      maxOrbitRadius: 220,
      orbitRadiusScale: 0.28,
      minRingStep: 48,
      maxRingStep: 110,
      ringStepScale: 0.14,
      xBoundaryPadding: 120,
      yBoundaryPadding: 60,
      radiusOffsetPattern: [-120, -40, 40, 120, -80, 80],
      radiusOffsetRowIncrement: 30,
      minimumCardOrbitRadius: 80,
    },
    entry: {
      spawnMargin: 140,
      additionalStartRadius: 160,
      minimumStartRadius: 300,
      minTurns: 0.55,
      turnVariance: 0.35,
      progressStep: 0.0014,
      easingExponent: 0.85,
      verticalDropOffset: 80,
    },
    falling: {
      minDistance: 0.001,
      accelerationFactor: 0.35,
      velocityDamping: 0.982,
      minScale: 0.1,
      scaleDecay: 0.975,
      opacityDecay: 0.965,
    },
    respawn: {
      delayMs: 5000,
    },
    orbitSpeed: {
      base: 0.0002,
      variance: 0.00025,
    },
  } as const;

  const colorConfig = {
    spaceBackground: "#000",
    blackHoleFill: "#030303",
    glowGradientStops: [
      { stop: 0, color: "rgba(20,20,20,1)" },
      { stop: 0.45, color: "rgba(63,38,89,0.6)" },
      { stop: 1, color: "rgba(0,0,0,0)" },
    ],
    accretionRingStroke: "rgba(128,90,255,0.4)",
  } as const;

  let { cardConfigs = [] } = $props<{ cardConfigs?: CardConfig[] }>();

  // Black hole config
  const blackhole = {
    x: 0,
    y: 0,
    radius: animationConfig.blackHole.radius,
    absorbRadius: animationConfig.blackHole.absorbRadius,
    gravity: animationConfig.blackHole.gravity,
  };

  // Internal per-card physics
  type Physics = {
    orbitRadius: number;
    orbitAngle: number;
    orbitSpeed: number;
    orbitDirection: number;
    startOrbitRadius: number;
    entryProgress: number;
    entryStartAngle: number;
    entryTargetAngle: number;
    vx: number;
    vy: number;
    entering: boolean;
    falling: boolean;
    respawnAt: number | null;
  };

  function makePhysics(): Physics {
    return {
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed:
        animationConfig.orbitSpeed.base +
        Math.random() * animationConfig.orbitSpeed.variance,
      orbitDirection: 1,
      startOrbitRadius: 0,
      entryProgress: 0,
      entryStartAngle: 0,
      entryTargetAngle: 0,
      vx: 0,
      vy: 0,
      entering: true,
      falling: false,
      respawnAt: null,
    };
  }

  // Reactive display state (drives Svelte style: directives)
  let cards = $state<CardState[]>([]);
  let physics: Physics[] = [];

  // Canvas / renderer
  let canvas: HTMLCanvasElement;
  let frame = 0;

  // function drawAccretionRing(ctx: CanvasRenderingContext2D) {
  //   // Accretion "ring" (currently a single stroked arc segment).
  //   // It's animated by moving the arc's start/end angles a bit every frame,
  //   // which is why it can look less like a full torus/annulus effect.
  //   ctx.strokeStyle = colorConfig.accretionRingStroke;
  //   ctx.lineWidth = animationConfig.render.accretionRingWidth;
  //   ctx.beginPath();
  //   ctx.arc(
  //     blackhole.x,
  //     blackhole.y,
  //     // Radius of the arc relative to the black hole size.
  //     blackhole.radius * animationConfig.render.accretionRingRadiusMultiplier,
  //     // Start angle grows over time, creating the "sweeping" motion.
  //     frame * animationConfig.render.accretionStartSpeed,
  //     // End angle = a fixed sweep length + the same time-based rotation.
  //     // sweepAngle controls how long the bright segment is.
  //     Math.PI * animationConfig.render.accretionSweepAngle +
  //       frame * animationConfig.render.accretionStartSpeed,
  //   );
  //   ctx.stroke();
  // }

  function drawScene(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = colorConfig.spaceBackground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glowR =
      blackhole.radius * animationConfig.render.glowRadiusMultiplier;
    const g = ctx.createRadialGradient(
      blackhole.x,
      blackhole.y,
      blackhole.radius * animationConfig.render.glowInnerRadiusMultiplier,
      blackhole.x,
      blackhole.y,
      glowR,
    );
    for (const { stop, color } of colorConfig.glowGradientStops) {
      g.addColorStop(stop, color);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(blackhole.x, blackhole.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colorConfig.blackHoleFill;
    ctx.beginPath();
    ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
    ctx.fill();

    // drawAccretionRing(ctx);
  }

  // Orbit slot layout
  function getOrbitSlot(index: number, total: number) {
    const { orbitLayout } = animationConfig;
    const baseSlotsPerRing = orbitLayout.baseSlotsPerRing;
    const ring = Math.floor(index / baseSlotsPerRing);
    const ringStart = ring * baseSlotsPerRing;
    const ringCount = Math.min(baseSlotsPerRing, total - ringStart);
    const slotInRing = index - ringStart;
    const angle = -Math.PI / 2 + (Math.PI * 2 * slotInRing) / ringCount;
    const minSide = Math.max(
      orbitLayout.minViewportSide,
      Math.min(canvas.width, canvas.height),
    );
    const baseR = Math.max(
      orbitLayout.minOrbitRadius,
      Math.min(
        orbitLayout.maxOrbitRadius,
        minSide * orbitLayout.orbitRadiusScale,
      ),
    );
    const ringStep = Math.max(
      orbitLayout.minRingStep,
      Math.min(orbitLayout.maxRingStep, minSide * orbitLayout.ringStepScale),
    );
    const radius = baseR + ring * ringStep;
    return {
      x: Math.min(
        canvas.width - orbitLayout.xBoundaryPadding,
        Math.max(
          orbitLayout.xBoundaryPadding,
          blackhole.x + Math.cos(angle) * radius,
        ),
      ),
      y: Math.min(
        canvas.height - orbitLayout.yBoundaryPadding,
        Math.max(
          orbitLayout.yBoundaryPadding,
          blackhole.y + Math.sin(angle) * radius,
        ),
      ),
    };
  }

  function layoutCards(initial: boolean) {
    const total = cards.length;
    const offsets = animationConfig.orbitLayout.radiusOffsetPattern;

    cards.forEach((card, i) => {
      if (card.hidden) return;
      const physicsState = physics[i];
      const slot = getOrbitSlot(i, total);
      const radiusOffset =
        offsets[i % offsets.length] +
        Math.floor(i / offsets.length) *
          animationConfig.orbitLayout.radiusOffsetRowIncrement;
      const dx = slot.x - blackhole.x,
        dy = slot.y - blackhole.y;
      physicsState.orbitRadius = Math.max(
        80,
        Math.hypot(dx, dy) + radiusOffset,
      );
      physicsState.orbitAngle = Math.atan2(dy, dx);

      if (initial) {
        spawnFromSide(card, physicsState);

        beginEntry(card, physicsState);
      } else if (!physicsState.falling) {
        card.x = slot.x;
        card.y = slot.y;
        physicsState.entering = false;
      }
    });
  }
// Spawn a card from the side of the screen
  function spawnFromSide(card: CardState, physicsState: Physics) {
    const { spawnMargin } = animationConfig.entry;
    const side = Math.floor(Math.random() * 4);
    card.x =
      side === 0
        ? -spawnMargin
        : side === 1
          ? canvas.width + spawnMargin
          : Math.random() * canvas.width;
    card.y =
      side === 2
        ? -spawnMargin
        : side === 3
          ? canvas.height + spawnMargin
          : Math.random() * canvas.height;
  }

  // Begin the entry animation for a card
  function beginEntry(card: CardState, physicsState: Physics) {
    const dx = card.x - blackhole.x;
    const dy = card.y - blackhole.y;

    physicsState.startOrbitRadius = Math.max(
      physicsState.orbitRadius + animationConfig.entry.additionalStartRadius,
      animationConfig.entry.minimumStartRadius,
    );
    physicsState.entryStartAngle = Math.atan2(dy, dx);
    physicsState.orbitDirection = Math.random() < 0.5 ? -1 : 1;
    const turns =
      animationConfig.entry.minTurns +
      Math.random() * animationConfig.entry.turnVariance;
    physicsState.entryTargetAngle =
      physicsState.orbitAngle +
      physicsState.orbitDirection * turns * Math.PI * 2;
    physicsState.entryProgress = 0;
    physicsState.entering = true;
  }

  //  Per-card update
  function updateCard(card: CardState, physicsState: Physics) {
    if (card.hidden) {
      if (
        physicsState.respawnAt !== null &&
        Date.now() >= physicsState.respawnAt
      ) {
        // Reset visual state
        card.hidden = false;
        card.scale = 1;
        card.opacity = 1;

        // Reset physics flags
        physicsState.falling = false;
        physicsState.vx = 0;
        physicsState.vy = 0;

        spawnFromSide(card, physicsState);
        beginEntry(card, physicsState);

        physicsState.respawnAt = null;
      }
      return;
    }

    if (physicsState.entering && !physicsState.falling) {
      physicsState.entryProgress = Math.min(
        1,
        physicsState.entryProgress + animationConfig.entry.progressStep,
      );
      const eased = Math.pow(
        physicsState.entryProgress,
        animationConfig.entry.easingExponent,
      );
      const angle =
        physicsState.entryStartAngle +
        (physicsState.entryTargetAngle - physicsState.entryStartAngle) * eased;
      const radius =
        physicsState.startOrbitRadius +
        (physicsState.orbitRadius - physicsState.startOrbitRadius) * eased;
      card.x = blackhole.x + Math.cos(angle) * radius;
      card.y =
        blackhole.y +
        Math.sin(angle) * radius +
        (1 - eased) * animationConfig.entry.verticalDropOffset;
      if (physicsState.entryProgress >= 1) {
        physicsState.entering = false;
        physicsState.orbitAngle = angle;
      }
    } else if (!physicsState.falling) {
      physicsState.orbitAngle +=
        physicsState.orbitSpeed * physicsState.orbitDirection;
      card.x =
        blackhole.x +
        Math.cos(physicsState.orbitAngle) * physicsState.orbitRadius;
      card.y =
        blackhole.y +
        Math.sin(physicsState.orbitAngle) * physicsState.orbitRadius;
    }

    if (physicsState.falling) {
      const dx = blackhole.x - card.x,
        dy = blackhole.y - card.y;
      const dist = Math.hypot(dx, dy) || animationConfig.falling.minDistance;
      physicsState.vx =
        (physicsState.vx +
          (dx / dist) *
            blackhole.gravity *
            animationConfig.falling.accelerationFactor) *
        animationConfig.falling.velocityDamping;
      physicsState.vy =
        (physicsState.vy +
          (dy / dist) *
            blackhole.gravity *
            animationConfig.falling.accelerationFactor) *
        animationConfig.falling.velocityDamping;
      card.x += physicsState.vx;
      card.y += physicsState.vy;
      card.scale = Math.max(
        animationConfig.falling.minScale,
        card.scale * animationConfig.falling.scaleDecay,
      );
      card.opacity = Math.max(
        0,
        card.opacity * animationConfig.falling.opacityDecay,
      );
      if (dist < blackhole.absorbRadius) {
        card.hidden = true;
        physicsState.respawnAt = Date.now() + animationConfig.respawn.delayMs;
      }
    }
    // scale/opacity recovery is handled by CSS transition when not falling
  }

  // ─── Mount ───────────────────────────────────────────────────────────────────
  onMount(() => {
    const ctx = canvas.getContext("2d")!;
    let initialized = false;

    cards = cardConfigs.map((c) => ({
      ...c,
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      hidden: false,
      hovered: false,
    }));
    physics = cards.map(() => makePhysics());

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      blackhole.x = canvas.width / 2;
      blackhole.y = canvas.height / 2;
      layoutCards(!initialized);
      initialized = true;
    }

    resize();
    window.addEventListener("resize", resize);

    const rafId = { id: 0 };
    function tick() {
      cards.forEach((card, i) => updateCard(card, physics[i]));
      frame++;
      drawScene(ctx);
      rafId.id = requestAnimationFrame(tick);
    }
    rafId.id = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId.id);
    };
  });
</script>

<main class="page">
  <canvas bind:this={canvas} class="space" aria-hidden="true"></canvas>
  <section class="card-layer" aria-label="Onderzoeksvragen">
    {#each cards as card (card.id)}
      {#if !card.hidden}
        <a
          class="orbit-card"
          class:hovered={card.hovered}
          href={`/onderzoeksvragen/${card.id}`}
          style:left="{card.x}px"
          style:top="{card.y}px"
          style:transform="translate(-50%, -50%) scale({card.scale})"
          style:opacity={card.opacity}
          onmouseenter={() => {
            card.hovered = true;
          }}
          onmouseleave={() => {
            card.hovered = false;
            physics[cards.indexOf(card)].falling = true;
          }}
          onfocus={() => {
            card.hovered = true;
          }}
          onblur={() => {
            card.hovered = false;
            physics[cards.indexOf(card)].falling = true;
          }}
        >
          <h2>{card.title}</h2>
          <p>{card.subtitle}</p>
        </a>
      {/if}
    {/each}
  </section>
</main>

<style>
  .page {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .space {
    position: absolute;
    inset: 0;
  }
  .card-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .orbit-card {
    position: absolute;
    pointer-events: all;
    /* CSS handles scale/opacity recovery — no JS lerp needed */
    transition:
      transform 0.25s ease,
      opacity 0.3s ease;
    /* ... your card styles ... */
  }

  .orbit-card.hovered {
    /* hover state via CSS class, not JS scale lerp */
    transform: translate(-50%, -50%) scale(1.06) !important;
  }
</style>
