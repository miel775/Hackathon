<script>
    import Viewtransition from "$lib/components/viewtransition.svelte";
    import Blackhole from "$lib/components/blackhole.svelte";
    import "$lib/style.css";
</script>
    <Viewtransition />


    <div id="easter-egg-content">
      <h1> The End </h1>
      <a href="/"> Go Back </a>
    </div>
        <Blackhole expanded={true} />
    <style>
    #easter-egg-content {
      position: relative;
      z-index: 10;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    </style>


