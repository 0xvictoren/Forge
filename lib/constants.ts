export const PLATFORM_FEE_BPS =
  Number(process.env.PLATFORM_FEE_BPS) || 200; // 2% default

export const MODULE_NAME = "forge";

export const BURNLINK_STORAGE_FEE_APT =
  Number(process.env.NEXT_PUBLIC_BURNLINK_STORAGE_FEE_APT) || 0.5;

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  process.env.NEXT_PUBLIC_MODULE_ADDRESS ||
  "";

export const PLATFORM_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || "";

export enum AccessLevel {
  FREE = 0,
  SUBSCRIBERS_ONLY = 1,
  PAID = 2,
  TIER_1 = 3,
  TIER_2 = 4,
}

export enum ContentType {
  VIDEO = "VIDEO",
  IMAGE = "IMAGE",
  AUDIO = "AUDIO",
  PDF = "PDF",
  ZIP = "ZIP",
  DOCUMENT = "DOCUMENT",
}

export const VERIFICATION_COST_APT = Number(process.env.VERIFICATION_COST_APT) || 10;

export enum TxType {
  UNLOCK_SALE = "UNLOCK_SALE",
  UNLOCK_PAYMENT = "UNLOCK_PAYMENT",
  SUBSCRIPTION_RECEIVED = "SUBSCRIPTION_RECEIVED",
  SUBSCRIPTION_PAID = "SUBSCRIPTION_PAID",
  TIP_RECEIVED = "TIP_RECEIVED",
  TIP_SENT = "TIP_SENT",
  CONTENT_PURCHASE = "CONTENT_PURCHASE",
  CONTENT_SALE = "CONTENT_SALE",
  INVOICE_PAYMENT = "INVOICE_PAYMENT",
  INVOICE_RECEIVED = "INVOICE_RECEIVED",
  VERIFICATION = "VERIFICATION",
  PLATFORM_FEE = "PLATFORM_FEE",
}

export const EXPLORE_CATEGORIES = [
  { id: "for-you", label: "For You", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80" },
  { id: "graphic-design", label: "Graphic Design", image: "https://images.unsplash.com/photo-1626785774573-4b799314346d?w=400&q=80" },
  { id: "3d-art", label: "3D Art", image: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80" },
  { id: "ui-ux", label: "UI/UX", image: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=400&q=80" },
  { id: "photography", label: "Photography", image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&q=80" },
  { id: "motion", label: "Motion", image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80" },
  { id: "illustration", label: "Illustration", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80" },
  { id: "web3", label: "Web3", image: "https://images.unsplash.com/photo-1639762681485-074b7f938aa0?w=400&q=80" },
] as const;
