<script>
    import gsap from 'gsap';
    import { onMount } from 'svelte';

    let textElement;

    onMount(() => {
        gsap.to(textElement, {
            rotation: 360,
            // Use svgOrigin instead of transformOrigin for bulletproof SVG rotation
            svgOrigin: "125 125", 
            duration: 10, 
            ease: "none",
            repeat: -1    
        });
    });
</script>

<svg id="blackhole" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250">
  <path id="circle-path" 
        d="M 25, 125 a 100,100 0 1,1 200,0 a 100,100 0 1,1 -200,0" 
        fill="none" />
        
  <circle cx="125" cy="125" r="100" class="ring-outline" />
  
  <text class="orbit-text" bind:this={textElement}>
      <textPath href="#circle-path" startOffset="5%">
         Onderzoeksvragen
      </textPath>
  </text>
</svg>

<style>
    #blackhole {
        stroke: #fff;
        stroke-miterlimit: 10;
        font-family: "Space Mono", monospace;
        overflow: visible;
        /* Optional: Add this to center the SVG element itself in its container */
        display: block;
        margin: 0 auto;
    }

    .orbit-text {
        font-size: 32px;
    }
</style>