<script lang="ts">
  import BlackHole from "$lib/components/blackhole.svelte";

  import "$lib/styles/home.css";

  let { data } = $props();
</script>

<svelte:head>
  <title>Onderzoeksvragen</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<BlackHole />
