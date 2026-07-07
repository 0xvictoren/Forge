const ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || "10feLhDccI7Zmkz3ozcFhI6Sau7rhFkDNfpHC1UHDLM";

export async function searchUnsplashImages(query: string, count: number = 1): Promise<string[]> {
  if (!ACCESS_KEY) return [];
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        },
        next: { revalidate: 3600 * 24 }, // cache a day
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => r.urls.regular || r.urls.full);
  } catch {
    return [];
  }
}

export const UNSPLASH_FALLBACKS = {
  hero: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&q=80", // creative workspace
  creator: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", // portrait
  pdf: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&q=80", // documents / guides
  video: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80", // video production / courses
  audio: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&q=80", // music production / audio
  design: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80", // design systems
  code: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80", // code / templates
  pack: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80", // creator kits / bundles
  portrait1: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
  portrait2: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  portrait3: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
};
