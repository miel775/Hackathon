<script lang="ts">
  import { page } from "$app/state";
  import "$lib/styles/detail.css";

  type DetailData = {
    title: string;
    body: string;
  };

  let { data } = $props<{ data: DetailData }>();
</script>

<svelte:head>
  <title>{data.title} | Onderzoeksvragen</title>
</svelte:head>

<main class="detail-page">
  <a class="back-link" href="/">← Back to overview</a>
  <article class="card">
    <h1>{data.title}</h1>
    <p>{@html data.body}</p>
    <p class="slug">Slug: {page.params.slug}</p>
  </article>
</main>
