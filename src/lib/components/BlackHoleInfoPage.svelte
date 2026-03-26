<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";

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
      radius: 18, // Base black hole size (also drives glow and ring placement).
      absorbRadius: 30, // Distance where orbiting cards are considered “absorbed”.
      gravity: 0.12, // Pull strength toward the center (affects entry/fall feel).
    },
    render: {
      glowRadiusMultiplier: 7.0, // Outer radial-gradient radius relative to blackHole.radius.
      glowInnerRadiusMultiplier: 0.05, // Inner radial-gradient radius relative to blackHole.radius.
      accretionRingWidth: 1, // Stroke width for the accretion ring
      accretionRingRadiusMultiplier: 3.55, // Arc radius relative to blackHole.radius.
      accretionRingRadius: 5,
      accretionRingGrowthRate: 0,
      accretionRingInitialAngle: 100,
      accretionRingAngleStep: 0.1,

      accretionStartSpeed: 0.001, // Per-frame speed for the ring’s start angle.
      accretionSweepAngle: 1.3, // Arc length (radians) swept each frame.
    },
    orbitLayout: {
      baseSlotsPerRing: 6, // Default capacity: cards per ring before adding a new ring.
      minViewportSide: 200, // Minimum canvas dimension used for responsive scaling.
      minOrbitRadius: 100, // Lower bound for the first ring radius.
      maxOrbitRadius: 220, // Upper bound for orbit radius scaling.
      orbitRadiusScale: 0.28, // Multiplier to derive orbit radii from viewport size.
      minRingStep: 48, // Lower bound for the spacing between rings.
      maxRingStep: 110, // Upper bound for the spacing between rings.
      ringStepScale: 0.14, // Multiplier to derive ring spacing from viewport size.
      xBoundaryPadding: 120, // Horizontal padding to keep cards inside the canvas.
      yBoundaryPadding: 60, // Vertical padding to keep cards inside the canvas.
      radiusOffsetPattern: [-120, -40, 40, 120, -80, 80], // Per-slot radial jitter to stagger card positions.
      radiusOffsetRowIncrement: 30, // Extra radial jitter per “row” (higher ring index).
      minimumCardOrbitRadius: 80, // Clamp so cards never approach closer than this orbit radius.
    },
    entry: {
      spawnMargin: 140, // Off-screen margin for initial spawn positions.
      additionalStartRadius: 160, // Extra radius added so each card starts further out.
      minimumStartRadius: 400, // Clamp to ensure entry starts from a comfortable distance.
      minTurns: 0.55, // Minimum number of orbit turns during the entry animation.
      turnVariance: 0.35, // Random variation added to turns per card.
      progressStep: 0.00014, // How quickly entry progress advances each frame.
      easingExponent: 0.95, // Easing exponent shaping: how the entry speed ramps.
      verticalDropOffset: 80, // Added vertical variation so entries aren’t perfectly symmetrical.
    },
    falling: {
      minDistance: 0.001, // Threshold distance before considering the card “done”.
      accelerationFactor: 0.25, // How quickly velocity changes while falling.
      velocityDamping: 0.982, // Per-frame multiplier damping velocity for a smoother fall.
      minScale: 0.1, // Smallest scale applied as cards shrink into the black hole.
      scaleDecay: 0.995, // Per-frame multiplicative scale shrink.
      opacityDecay: 0.965, // Per-frame multiplicative fade-out.
    },
    respawn: {
      delayMs: 5000, // Wait time before spawning the next card after absorption.
    },
    orbitSpeed: {
      base: 0.0002, // Base tangential orbit speed.
      variance: 0.00025, // Random additional orbit speed per card.
    },
  } as const;

  const colorConfig = {
    spaceBackground: "#000", // Background color for the canvas.
    blackHoleFill: "#030303", // Fill color of the black hole core disk.
    glowGradientStops: [
      { stop: 0, color: "rgba(20,20,20,1)" }, // 0 = inner radius color.
      { stop: 0.45, color: "rgba(248, 132, 12,0.3)" }, // Mid glow color.
      { stop: 0.65, color: "rgba(248, 132, 12,0.2)" }, // Outer middle glow color.
      { stop: 1, color: "rgba(0,0,0,0)" }, // 1 = outer radius.
    ],
    accretionRingStroke: "rgba(128,90,255,0.4)", // Stroke color for the accretion arc (includes alpha).
  } as const;
  let { cardConfigs = [], expanded = false } = $props<{
    cardConfigs: CardConfig[];
    expanded: boolean;
  }>();

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

  let textElement = $state<SVGTextElement | null>(null);

  function drawAccretionRing(ctx: CanvasRenderingContext2D) {
    // Accretion "ring" (currently a single stroked arc segment).
    // It's animated by moving the arc's start/end angles a bit every frame.

    const growthRate = animationConfig.render.accretionRingGrowthRate;
    ctx.strokeStyle = colorConfig.accretionRingStroke;
    ctx.lineWidth = animationConfig.render.accretionRingWidth;

    let angleStep = animationConfig.render.accretionRingAngleStep;
    let angle = animationConfig.render.accretionRingInitialAngle;
    const centerX = blackhole.x;
    const centerY = blackhole.y;

    let currentAngle = 0;
    while (currentAngle < angle) {
      const radius = growthRate * currentAngle;
      const x = centerX + radius * Math.cos(currentAngle);
      const y = centerY + radius * Math.sin(currentAngle);
      ctx.lineTo(x, y);
      currentAngle += angleStep;
    }
    ctx.stroke();
  }

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

    drawAccretionRing(ctx);
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
        animationConfig.orbitLayout.minOrbitRadius,
        Math.hypot(dx, dy) + radiusOffset,
      );
      physicsState.orbitAngle = Math.atan2(dy, dx);

      if (initial) {
        card.x = slot.x;
        card.y = slot.y;
        physicsState.entering = false;
        physicsState.falling = false;
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

    // Use the card's actual spawn distance as the starting radius.
    const spawnDist = Math.hypot(dx, dy);

    physicsState.startOrbitRadius = Math.max(
      spawnDist,
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

    if (textElement) {
      gsap.to(textElement, {
        rotation: 360,
        svgOrigin: "125 125",
        duration: 10,
        ease: "none",
        repeat: -1,
      });
    }

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
  {#if !expanded}
    <a
      class="blackhole-link"
      href="/easteregg"
      aria-label="Easter egg"
      title="Easter egg"
    >
      <svg
        id="blackhole"
        data-name="Layer 1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 250 250"
      >
        <path
          id="circle-path"
          d="M 25, 125 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0"
          fill="none"
        />
        <circle cx="125" cy="125" r="100" class="ring-outline" />

        <text class="orbit-text" bind:this={textElement}>
          <textPath href="#circle-path" startOffset="5%">
            Onderzoeksvragen
          </textPath>
        </text>
      </svg>
    </a>
  {:else}
    <svg
      id="blackhole"
      class="expanded"
      data-name="Layer 1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 250 250"
    >
      <path
        id="circle-path"
        d="M 25, 125 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0"
        fill="none"
      />
      <circle cx="125" cy="125" r="100" class="ring-outline fill-black" />

      <text class="orbit-text" bind:this={textElement}>
        <textPath href="#circle-path" startOffset="5%">
          Onderzoeksvragen
        </textPath>
      </text>
    </svg>
  {/if}
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
    z-index: 0;
  }
  .card-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .blackhole-link {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
  }

  #blackhole {
    stroke-miterlimit: 10;
    font-family: "Space Mono", monospace;
    display: block;
    overflow: visible;
    width: 256px;
    box-shadow: 0 0 50px 30px var(--secondary-color);
    border-radius: 50%;
    view-transition-name: blackhole-morph;
  }

  #blackhole.expanded {
    width: max(200vw, 200vh);
    height: max(200vw, 200vh);
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: -1;
  }

  #blackhole.expanded .fill-black {
    fill: var(--primary-color-dark);
  }

  .orbit-text {
    stroke: #fff;
    font-size: 32px;
  }

  .orbit-card {
    position: absolute;
    pointer-events: all;
    transition:
      transform 0.25s ease,
      opacity 0.3s ease;
  }

  .orbit-card.hovered {
    transform: translate(-50%, -50%) scale(1.06) !important;
  }
</style>
