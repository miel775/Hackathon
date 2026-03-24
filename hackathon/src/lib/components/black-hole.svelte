<script>
    import gsap from 'gsap';
    import { onMount } from 'svelte';

    let textElement;

    onMount(() => {
        gsap.to(textElement, {
            rotation: 360,
            svgOrigin: "125 125", 
            duration: 10, 
            ease: "none",
            repeat: -1    
        });
    });
</script>

<a href="/easteregg">
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
</a>

<style>
    #blackhole {
        stroke: #fff;
        stroke-miterlimit: 10;
        font-family: "Space Mono", monospace;
        display: block;
        overflow: visible;
        width: 256px;
        box-shadow: 0 0 50px 30px var(--secondary-color);
        border-radius: 50%;
    }

    .orbit-text {
        font-size: 32px;
    }

</style>