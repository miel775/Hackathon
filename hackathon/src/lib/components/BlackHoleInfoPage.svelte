<script lang="ts">
  import { onMount } from "svelte";

  type CardConfig = {
    id: string;
    title: string;
    subtitle: string;
  };

  let { cardConfigs = [] } = $props<{ cardConfigs?: CardConfig[] }>();

  let canvas: HTMLCanvasElement;
  let rafId: number | undefined;
  let engine: OrbitSceneEngine | undefined;
  let cards = $state<OrbitCard[]>([]);

  /**
   * Entity that stores black-hole physics parameters and center position.
   */
  class BlackHole {
    x: number;
    y: number;
    radius: number;
    absorbRadius: number;
    gravity: number;

    constructor(
      radius: number = 44,
      absorbRadius: number = 30,
      gravity: number = 0.24,
    ) {
      this.x = 0;
      this.y = 0;
      this.radius = radius;
      this.absorbRadius = absorbRadius;
      this.gravity = gravity;
    }

    setCenter(width: number, height: number): void {
      this.x = width * 0.5;
      this.y = height * 0.5;
    }
  }

  /**
   * Entity that encapsulates card behavior and motion.
   * Cards spawn from a screen side and queue into generated orbit slots.
   */
  class OrbitCard {
    id: string;
    title: string;
    subtitle: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
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
    scale: number;
    opacity: number;
    entering: boolean;
    hovered: boolean;
    falling: boolean;
    hidden: boolean;
    respawnAt: number | null;

    constructor(id: string, title: string, subtitle: string) {
      this.id = id;
      this.title = title;
      this.subtitle = subtitle;
      this.x = 0;
      this.y = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.orbitRadius = 0;
      this.orbitAngle = 0;
      this.orbitSpeed = 0.0002 + Math.random() * 0.00025;
      this.orbitDirection = 1;
      this.startOrbitRadius = 0;
      this.entryProgress = 0;
      this.entryStartAngle = 0;
      this.entryTargetAngle = 0;
      this.vx = 0;
      this.vy = 0;
      this.scale = 1;
      this.opacity = 1;
      this.entering = true;
      this.hovered = false;
      this.falling = false;
      this.hidden = false;
      this.respawnAt = null;
    }

    spawnFromSide(viewWidth: number, viewHeight: number): void {
      const side = Math.floor(Math.random() * 4);
      const margin = 140;

      if (side === 0) {
        this.x = -margin;
        this.y = Math.random() * viewHeight;
      } else if (side === 1) {
        this.x = viewWidth + margin;
        this.y = Math.random() * viewHeight;
      } else if (side === 2) {
        this.x = Math.random() * viewWidth;
        this.y = -margin;
      } else {
        this.x = Math.random() * viewWidth;
        this.y = viewHeight + margin;
      }
    }

    assignOrbitSlot(targetX: number, targetY: number): void {
      this.targetX = targetX;
      this.targetY = targetY;
    }

    setBlackHoleOrbit(
      centerX: number,
      centerY: number,
      radiusOffset: number = 0,
    ): void {
      const dx = this.targetX - centerX;
      const dy = this.targetY - centerY;
      this.orbitRadius = Math.max(80, Math.hypot(dx, dy) + radiusOffset);
      this.orbitAngle = Math.atan2(dy, dx);
    }

    beginEntryFromCurrent(centerX: number, centerY: number): void {
      const dx = this.x - centerX;
      const dy = this.y - centerY;
      this.startOrbitRadius = Math.max(this.orbitRadius + 160, Math.hypot(dx, dy));
      this.entryStartAngle = Math.atan2(dy, dx);
      const direction = Math.random() < 0.5 ? -1 : 1;
      this.orbitDirection = direction;
      const turns = 0.55 + Math.random() * 0.35;
      this.entryTargetAngle = this.orbitAngle + direction * turns * Math.PI * 2;
      this.entryProgress = 0;
      this.entering = true;
    }

    onHoverStart(): void {
      this.hovered = true;
    }

    onHoverEnd(): void {
      this.hovered = false;
      this.falling = true;
    }

    update(blackHole: BlackHole): void {
      if (this.hidden) {
        if (this.respawnAt !== null && Date.now() >= this.respawnAt) {
          // Re-activate card and place it back on orbit.
          this.hidden = false;
          this.falling = false;
          this.hovered = false;
          this.entering = true;
          this.scale = 1;
          this.opacity = 1;
          this.vx = 0;
          this.vy = 0;
          this.spawnFromSide(window.innerWidth, window.innerHeight);
          this.beginEntryFromCurrent(blackHole.x, blackHole.y);
          this.respawnAt = null;
        } else {
          return;
        }
      }
      if (this.entering && !this.falling) {
        // Descending spiral: cards orbit inward and settle into final orbit.
        this.entryProgress = Math.min(1, this.entryProgress + 0.0014);
        const eased = Math.pow(this.entryProgress, 0.85);
        const angle =
          this.entryStartAngle +
          (this.entryTargetAngle - this.entryStartAngle) * eased;
        const radius =
          this.startOrbitRadius +
          (this.orbitRadius - this.startOrbitRadius) * eased;
        const descendOffset = (1 - eased) * 80;
        this.x = blackHole.x + Math.cos(angle) * radius;
        this.y = blackHole.y + Math.sin(angle) * radius + descendOffset;

        if (this.entryProgress >= 1) {
          this.entering = false;
          this.orbitAngle = angle;
          this.x = blackHole.x + Math.cos(angle) * this.orbitRadius;
          this.y = blackHole.y + Math.sin(angle) * this.orbitRadius;
        }
      } else if (!this.falling) {
        // Orbit around the black-hole center in 2D.
        this.orbitAngle += this.orbitSpeed * this.orbitDirection;
        this.x = blackHole.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = blackHole.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      }

      if (this.falling) {
        const dx = blackHole.x - this.x;
        const dy = blackHole.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

        this.vx += (dx / dist) * (blackHole.gravity * 0.35);
        this.vy += (dy / dist) * (blackHole.gravity * 0.35);
        this.vx *= 0.982;
        this.vy *= 0.982;

        this.x += this.vx;
        this.y += this.vy;
        this.scale = Math.max(0.1, this.scale * 0.975);
        this.opacity = Math.max(0, this.opacity * 0.965);

        if (dist < blackHole.absorbRadius) {
          this.hidden = true;
          this.respawnAt = Date.now() + 5000;
        }
      } else if (this.hovered) {
        this.scale = Math.min(1.06, this.scale + 0.02);
      } else {
        this.scale += (1 - this.scale) * 0.18;
        this.opacity += (1 - this.opacity) * 0.18;
      }
    }
  }

  function applyCardStyles(): void {
    cards.forEach((card) => {
      const el = document.querySelector(
        `[data-card-id="${card.id}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      if (card.hidden) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      el.style.left = `${card.x}px`;
      el.style.top = `${card.y}px`;
      el.style.transform = `translate(-50%, -50%) scale(${card.scale})`;
      el.style.opacity = `${card.opacity}`;
    });
  }

  /**
   * Responsible only for drawing canvas visuals.
   */
  class SceneRenderer {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    blackHole: BlackHole;
    frame: number;

    constructor(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      blackHole: BlackHole,
    ) {
      this.ctx = ctx;
      this.canvas = canvas;
      this.blackHole = blackHole;
      this.frame = 0;
    }

    nextFrame(): void {
      this.frame += 1;
    }

    draw(): void {
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawBlackHole();
    }

    drawBlackHole(): void {
      const pulse = Math.sin(this.frame * 0.02) * 5;
      const glowRadius = this.blackHole.radius * 2.6 + pulse;
      const gradient = this.ctx.createRadialGradient(
        this.blackHole.x,
        this.blackHole.y,
        this.blackHole.radius * 0.35,
        this.blackHole.x,
        this.blackHole.y,
        glowRadius,
      );

      gradient.addColorStop(0, "rgba(20,20,20,1)");
      gradient.addColorStop(0.45, "rgba(63,38,89,0.6)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(
        this.blackHole.x,
        this.blackHole.y,
        glowRadius,
        0,
        Math.PI * 2,
        true,
      );
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = "#030303";
      this.ctx.beginPath();
      this.ctx.arc(
        this.blackHole.x,
        this.blackHole.y,
        this.blackHole.radius,
        0,
        Math.PI * 2,
        true,
      );
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.strokeStyle = "rgba(128, 90, 255, 0.4)";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(
        this.blackHole.x,
        this.blackHole.y,
        this.blackHole.radius * 1.55,
        this.frame * 0.01,
        Math.PI * 1.3 + this.frame * 0.01,
      );
      this.ctx.stroke();
    }
  }

  /**
   * Coordinates entities and renderer; single entrypoint for the animation loop.
   */
  class OrbitSceneEngine {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    blackHole: BlackHole;
    cards: OrbitCard[];
    renderer: SceneRenderer;
    initializedLayout: boolean;

    constructor(canvasElement: HTMLCanvasElement, cardEntities: OrbitCard[]) {
      this.canvas = canvasElement;
      const canvasContext = canvasElement.getContext("2d");
      if (!canvasContext) {
        throw new Error("Could not get 2D canvas context.");
      }
      this.ctx = canvasContext;
      this.blackHole = new BlackHole();
      this.cards = cardEntities;
      this.renderer = new SceneRenderer(this.ctx, this.canvas, this.blackHole);
      this.initializedLayout = false;
    }

    getOrbitSlot(index: number, total: number): { x: number; y: number } {
      // Fill orbit bands around the black hole.
      const baseSlotsPerRing = 6;
      const ring = Math.floor(index / baseSlotsPerRing);
      const ringStart = ring * baseSlotsPerRing;
      const ringCount = Math.min(baseSlotsPerRing, total - ringStart);
      const slotInRing = index - ringStart;
      const angle = -Math.PI / 2 + (Math.PI * 2 * slotInRing) / ringCount;
      const minViewportSide = Math.max(
        200,
        Math.min(this.canvas.width, this.canvas.height),
      );
      // Keep slot radius adaptive so cards stay visible on small screens.
      const adaptiveBaseRadius = Math.max(
        90,
        Math.min(220, minViewportSide * 0.28),
      );
      const adaptiveRingStep = Math.max(
        48,
        Math.min(110, minViewportSide * 0.14),
      );
      const radius = adaptiveBaseRadius + ring * adaptiveRingStep;
      const rawX = this.blackHole.x + Math.cos(angle) * radius;
      const rawY = this.blackHole.y + Math.sin(angle) * radius;
      const cardHalfWidth = 120;
      const cardHalfHeight = 60;
      const x = Math.min(
        this.canvas.width - cardHalfWidth,
        Math.max(cardHalfWidth, rawX),
      );
      const y = Math.min(
        this.canvas.height - cardHalfHeight,
        Math.max(cardHalfHeight, rawY),
      );
      return {
        x,
        y,
      };
    }

    layoutCards(initial: boolean): void {
      const total = this.cards.length;
      this.cards.forEach((card, index) => {
        if (card.hidden) return;
        const slot = this.getOrbitSlot(index, total);
        card.assignOrbitSlot(slot.x, slot.y);
        // Spread cards across multiple orbit bands to avoid overlap.
        const radiusPattern = [-120, -40, 40, 120, -80, 80];
        const radiusOffset =
          radiusPattern[index % radiusPattern.length] +
          Math.floor(index / radiusPattern.length) * 30;
        card.setBlackHoleOrbit(
          this.blackHole.x,
          this.blackHole.y,
          radiusOffset,
        );

        if (initial) {
          card.spawnFromSide(this.canvas.width, this.canvas.height);
          card.beginEntryFromCurrent(this.blackHole.x, this.blackHole.y);
        } else if (!card.falling) {
          // Keep cards aligned to new slots after resize.
          card.x = slot.x;
          card.y = slot.y;
          card.entering = false;
        }
      });
    }

    resize(): void {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.blackHole.setCenter(this.canvas.width, this.canvas.height);
      this.layoutCards(!this.initializedLayout);
      this.initializedLayout = true;
    }

    step(): void {
      this.cards.forEach((card) => card.update(this.blackHole));
      this.renderer.nextFrame();
      this.renderer.draw();
    }
  }

  onMount(() => {
    cards = cardConfigs.map(
      (config: CardConfig) =>
        new OrbitCard(config.id, config.title, config.subtitle),
    );
    const sceneEngine = new OrbitSceneEngine(canvas, cards);
    engine = sceneEngine;
    sceneEngine.resize();
    const onResize = (): void => sceneEngine.resize();

    const tick = () => {
      sceneEngine.step();
      applyCardStyles();
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafId) cancelAnimationFrame(rafId);
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
          data-card-id={card.id}
          href={`/onderzoeksvragen/${card.id}`}
          onmouseenter={() => card.onHoverStart()}
          onmouseleave={() => card.onHoverEnd()}
          onfocus={() => card.onHoverStart()}
          onblur={() => card.onHoverEnd()}
        >
          <h2>{card.title}</h2>
          <p>{card.subtitle}</p>
        </a>
      {/if}
    {/each}
  </section>
</main>
