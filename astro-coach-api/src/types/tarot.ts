export type TarotCard = {
  id: string;
  arcana: "major" | "minor";
  suit: string | null;
  displayNumber: string;
  sortOrder: number;
  astrologySign: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  en: { title: string; description: string; keywords: string[] };
  fa: { title: string; description: string; keywords: string[] };
};
