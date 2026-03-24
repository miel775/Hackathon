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

  let { cardConfigs = [] } = $props<{ cardConfigs?: CardConfig[] }>();

  // Black hole config 
  const blackhole = { x: 0, y: 0, radius: 44, absorbRadius: 30, gravity: 0.24 };

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
      orbitSpeed: 0.0002 + Math.random() * 0.00025,
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

  function drawScene(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pulse = Math.sin(frame * 0.02) * 5;
    const glowR = blackhole.radius * 2.6 + pulse;
    const g = ctx.createRadialGradient(
      blackhole.x,
      blackhole.y,
      blackhole.radius * 0.35,
      blackhole.x,
      blackhole.y,
      glowR,
    );
    g.addColorStop(0, "rgba(20,20,20,1)");
    g.addColorStop(0.45, "rgba(63,38,89,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(blackhole.x, blackhole.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#030303";
    ctx.beginPath();
    ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(128,90,255,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      blackhole.x,
      blackhole.y,
      blackhole.radius * 1.55,
      frame * 0.01,
      Math.PI * 1.3 + frame * 0.01,
    );
    ctx.stroke();
  }

  // Orbit slot layout
  function getOrbitSlot(index: number, total: number) {
    const baseSlotsPerRing = 6;
    const ring = Math.floor(index / baseSlotsPerRing);
    const ringStart = ring * baseSlotsPerRing;
    const ringCount = Math.min(baseSlotsPerRing, total - ringStart);
    const slotInRing = index - ringStart;
    const angle = -Math.PI / 2 + (Math.PI * 2 * slotInRing) / ringCount;
    const minSide = Math.max(200, Math.min(canvas.width, canvas.height));
    const baseR = Math.max(90, Math.min(220, minSide * 0.28));
    const ringStep = Math.max(48, Math.min(110, minSide * 0.14));
    const radius = baseR + ring * ringStep;
    return {
      x: Math.min(
        canvas.width - 120,
        Math.max(120, blackhole.x + Math.cos(angle) * radius),
      ),
      y: Math.min(
        canvas.height - 60,
        Math.max(60, blackhole.y + Math.sin(angle) * radius),
      ),
    };
  }

  function layoutCards(initial: boolean) {
    const total = cards.length;
    const offsets = [-120, -40, 40, 120, -80, 80];

    cards.forEach((card, i) => {
      if (card.hidden) return;
      const physicsState = physics[i];
      const slot = getOrbitSlot(i, total);
      const radiusOffset =
        offsets[i % offsets.length] + Math.floor(i / offsets.length) * 30;
      const dx = slot.x - blackhole.x,
        dy = slot.y - blackhole.y;
      physicsState.orbitRadius = Math.max(80, Math.hypot(dx, dy) + radiusOffset);
      physicsState.orbitAngle = Math.atan2(dy, dx);

      if (initial) {
        spawnFromSide(card, physicsState);
        beginEntry(physicsState);
      } else if (!physicsState.falling) {
        card.x = slot.x;
        card.y = slot.y;
        physicsState.entering = false;
      }
    });
  }

  function spawnFromSide(card: CardState, physicsState: Physics) {
    const side = Math.floor(Math.random() * 4);
    const m = 140;
    card.x =
      side === 0
        ? -m
        : side === 1
          ? canvas.width + m
          : Math.random() * canvas.width;
    card.y =
      side === 2
        ? -m
        : side === 3
          ? canvas.height + m
          : Math.random() * canvas.height;
  }

  function beginEntry(physicsState: Physics) {
    const dx = 0,
      dy = 0; // placeholder — actual card x/y used below
    physicsState.startOrbitRadius = Math.max(physicsState.orbitRadius + 160, 300);
    physicsState.entryStartAngle = Math.atan2(dy, dx);
    physicsState.orbitDirection = Math.random() < 0.5 ? -1 : 1;
    const turns = 0.55 + Math.random() * 0.35;
    physicsState.entryTargetAngle =
      physicsState.orbitAngle + physicsState.orbitDirection * turns * Math.PI * 2;
    physicsState.entryProgress = 0;
    physicsState.entering = true;
  }

  //  Per-card update 
  function updateCard(card: CardState, physicsState: Physics) {
    if (card.hidden) {
      if (physicsState.respawnAt !== null && Date.now() >= physicsState.respawnAt) {
        card.hidden = false;
        card.scale = 1;
        card.opacity = 1;
        physicsState.falling = false;
        physicsState.vx = 0;
        physicsState.vy = 0;
        spawnFromSide(card, physicsState);
        physicsState.startOrbitRadius = Math.max(physicsState.orbitRadius + 160, 300);
        physicsState.entryStartAngle = Math.atan2(
          card.y - blackhole.y,
          card.x - blackhole.x,
        );
        physicsState.entryTargetAngle =
          physicsState.orbitAngle +
          physicsState.orbitDirection * (0.55 + Math.random() * 0.35) * Math.PI * 2;
        physicsState.entryProgress = 0;
        physicsState.entering = true;
        physicsState.respawnAt = null;
      }
      return;
    }

    if (physicsState.entering && !physicsState.falling) {
      physicsState.entryProgress = Math.min(1, physicsState.entryProgress + 0.0014);
      const eased = Math.pow(physicsState.entryProgress, 0.85);
      const angle =
        physicsState.entryStartAngle +
        (physicsState.entryTargetAngle - physicsState.entryStartAngle) * eased;
      const radius =
        physicsState.startOrbitRadius +
        (physicsState.orbitRadius - physicsState.startOrbitRadius) * eased;
      card.x = blackhole.x + Math.cos(angle) * radius;
      card.y = blackhole.y + Math.sin(angle) * radius + (1 - eased) * 80;
      if (physicsState.entryProgress >= 1) {
        physicsState.entering = false;
        physicsState.orbitAngle = angle;
      }
    } else if (!physicsState.falling) {
      physicsState.orbitAngle += physicsState.orbitSpeed * physicsState.orbitDirection;
      card.x = blackhole.x + Math.cos(physicsState.orbitAngle) * physicsState.orbitRadius;
      card.y = blackhole.y + Math.sin(physicsState.orbitAngle) * physicsState.orbitRadius;
    }

    if (physicsState.falling) {
      const dx = blackhole.x - card.x,
        dy = blackhole.y - card.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      physicsState.vx =
        (physicsState.vx + (dx / dist) * blackhole.gravity * 0.35) * 0.982;
      physicsState.vy =
        (physicsState.vy + (dy / dist) * blackhole.gravity * 0.35) * 0.982;
      card.x += physicsState.vx;
      card.y += physicsState.vy;
      card.scale = Math.max(0.1, card.scale * 0.975);
      card.opacity = Math.max(0, card.opacity * 0.965);
      if (dist < blackhole.absorbRadius) {
        card.hidden = true;
        physicsState.respawnAt = Date.now() + 5000;
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
