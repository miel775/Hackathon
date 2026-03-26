<script>
  import Viewtransition from "$lib/components/viewtransition.svelte";
  import Blackhole from "$lib/components/blackhole.svelte";
    import Alien from "$lib/components/aliencomponent.svelte";
  import "$lib/styles/style.css";
</script>

  <svelte:head>
    <title>Surprise an alien</title>
  </svelte:head>
    <Viewtransition />
<main>
    <div id="easter-egg-content">
        <Alien />
        <div id="easter-egg-text">
          <h1> The End </h1>
          <a href="/"> Go Back </a>
        </div>
    </div>

    <div id="giant-hole-wrapper">
        <Blackhole expanded={true} />
    </div>
  </main>


<style>
    h1 {
      color: red;
      font-size: 72px;
    }

    a {
      margin-left: 4em;
      width: 8em;
      height: 2em;
      background-color: #196600;
      color: var(--neutral-color-white);
      padding: 1em;
      border: solid 2px red;
      text-decoration: none;
      display: flex;
      justify-content: center;
    }

#giant-hole-wrapper {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: -1;
        pointer-events: none;
        display: flex; 
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    #easter-egg-content {
      display: grid;
      place-items: center;
      height: 100vh;
      margin-top: 5em;
    }

    #easter-egg-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      animation: toabove 0.4s forwards;
       animation-delay: 3s;
       transform: translateY(300%);
    }

    @keyframes toabove {
      from {
        transform:  translateY(300%);
      }

      to {
        transform: translateY(0%);
      }
    }

    </style>


