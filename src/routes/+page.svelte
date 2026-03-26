<script lang="ts">
  import BlackHoleInfoPage from "$lib/components/BlackHoleInfoPage.svelte";
  import Viewtransition from "$lib/components/viewtransition.svelte";
  import "$lib/styles/home.css";
  import "$lib/styles/style.css"

  let { data } = $props();
</script>

<svelte:head>
  <title>Onderzoeksvragen</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div id="giant-hole-wrapper">
<BlackHoleInfoPage cardConfigs={data.cards} expanded={false} />
</div>

<Viewtransition />

<style>
#giant-hole-wrapper {
      position: fixed; 
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10; 
  }


</style>