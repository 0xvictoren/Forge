/**
 * Curated Unsplash photography (fetched once with the project's Unsplash key,
 * hot-linked per Unsplash API guidelines, credited in the UI).
 */
export type Photo = { id: string; base: string; alt: string; author: string; authorUrl: string; color: string };

export const PHOTOS = {
  hero: { id: "xuTJZ7uD7PI", base: "https://images.unsplash.com/photo-1644088379091-d574269d422f", alt: "a blue background with lines and dots", author: "Conny Schneider", authorUrl: "https://unsplash.com/@choys_", color: "#0c26a6" },
  heroAlt: { id: "pREq0ns_p_E", base: "https://images.unsplash.com/photo-1644325349124-d1756b79dd42", alt: "a blue abstract background with lines and dots", author: "Conny Schneider", authorUrl: "https://unsplash.com/@choys_", color: "#0c2673" },
  robotics: { id: "gEtezQMsu64", base: "https://images.unsplash.com/photo-1784821856280-401b76b03266", alt: "A robotic arm in a clean, minimalist laboratory setting", author: "Brecht Corbeel", authorUrl: "https://unsplash.com/@brechtcorbeel", color: "#c0d9d9" },
  pov: { id: "4nk7VPj_m6g", base: "https://images.unsplash.com/photo-1636647511729-6703539ba71f", alt: "a woman in a kitchen chopping vegetables on a cutting board", author: "Douglas Fehr", authorUrl: "https://unsplash.com/@roninfehr", color: "#260c0c" },
  datacenter: { id: "ISP9CdRYS28", base: "https://images.unsplash.com/photo-1752742111841-f490c48aa668", alt: "Servers illuminate a futuristic cityscape with a data center", author: "Markus Stickling", authorUrl: "https://unsplash.com/@stikkx", color: "#0c2640" },
  medical: { id: "BDKid0yJcAk", base: "https://images.unsplash.com/photo-1631563019676-dade0dbdb8fc", alt: "a black and white photo of various mri images", author: "National Cancer Institute", authorUrl: "https://unsplash.com/@nci", color: "#262626" },
  audio: { id: "c1ZN57GfDB0", base: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618", alt: "macro photography of silver and black studio microphone condenser", author: "Jonathan Velasquez", authorUrl: "https://unsplash.com/@jonathanvez", color: "#262626" },
  satellite: { id: "vhSz50AaFAs", base: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4", alt: "Earth with clouds above the African continent", author: "NASA", authorUrl: "https://unsplash.com/@nasa", color: "#595973" },
  autonomous: { id: "Qr67ewAPBvY", base: "https://images.unsplash.com/photo-1694729101068-a2c621f877b4", alt: "a car that is driving down the street", author: "gibblesmash asdf", authorUrl: "https://unsplash.com/@gibblesmash139", color: "#262626" },
  chip: { id: "qOx9KsvpqcM", base: "https://images.unsplash.com/photo-1587845323226-bad89242c735", alt: "A silicon wafer with a grid of iridescent microchip dies under shallow focus", author: "Laura Ockel", authorUrl: "https://unsplash.com/@viazavier", color: "#594040" },
  research: { id: "RAcNSUPk3b4", base: "https://images.unsplash.com/photo-1766297248160-87aca6fa59ef", alt: "Scientist points to microscopic view on computer screen", author: "Chidera Faustina Okeke", authorUrl: "https://unsplash.com/@thefourthwxll", color: "#a6a6a6" },
  abstract: { id: "cZgVpseeazg", base: "https://images.unsplash.com/photo-1545431766-45ff67845191", alt: "A soft abstract blur of rainbow colors including yellow, orange, and blue", author: "Sean Sinclair", authorUrl: "https://unsplash.com/@seanwsinclair", color: "#26260c" },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

export function photoUrl(photo: Photo, width = 1600, quality = 80) {
  return `${photo.base}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

export function photoCredit(photo: Photo) {
  return {
    text: `Photo by ${photo.author} on Unsplash`,
    href: `${photo.authorUrl}?utm_source=forge&utm_medium=referral`,
  };
}

/** Default cover per modality, used when a seller doesn't upload one. */
export const MODALITY_COVERS: Record<string, PhotoKey> = {
  VIDEO: "pov",
  ROBOTICS: "robotics",
  IMAGE: "medical",
  AUDIO: "audio",
  TEXT: "research",
  TABULAR: "datacenter",
  SENSOR: "autonomous",
  GEOSPATIAL: "satellite",
  MULTIMODAL: "abstract",
};
