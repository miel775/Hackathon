type CardConfig = {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  imageUrl: string;
  imageAlt: string;
  listItems: string;
};

export async function load({
  fetch,
  params,
}: {
  fetch: typeof globalThis.fetch;
  params: { slug: string };
}) {
  const fallback = {
    title: "Unknown topic",
    body: "No content exists for this slug yet.",
    content: "No content exists for this topic.",
    imageUrl: "No image exists for this topic",
    imageAlt: "No alt exists for this topic",
    listItems: "",
  };

  const response = await fetch("/cards.json");
  if (!response.ok) {
    return fallback;
  }

  const cards = (await response.json()) as CardConfig[];
  const match = cards.find(
    (card) => card.id.toLowerCase() === params.slug.toLowerCase(),
  );

  if (!match) {
    return fallback;
  }

  return {
    title: match.title,
    body: match.subtitle,
    content: match.content,
    imageUrl: match.imageUrl,
    imageAlt: match.imageAlt,
    listItems: match.listItems,
  };
}
