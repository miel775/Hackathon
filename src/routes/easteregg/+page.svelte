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

    <div id="giant-hole-wrapper">
        <Blackhole expanded={true} />
    </div>

    <style>
    h1 {
      color: red;
      font-size: 72px;
    }

    a {
      width: 12em;
      height: 3em;
      background-color: var(--primary-color-dark);
      color: var(--secondary-color);
      padding: 1em;
      border: solid 2px var(--secondary-color);
      text-decoration: none;
    }

#giant-hole-wrapper {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: -1;
        pointer-events: none;
        display: flex; 
        align-items: center;
        justify-content: center;
    }

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


