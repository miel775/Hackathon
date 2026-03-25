type CardConfig = {
  id: string;
  title: string;
  subtitle: string;
};
// Fetch cards
export async function load({ fetch }: { fetch: typeof globalThis.fetch }) {
  const response = await fetch("/cards.json");

  if (!response.ok) {
    return { cards: [] as CardConfig[] };
  }

  const cards = (await response.json()) as CardConfig[];
  return { cards };
}
