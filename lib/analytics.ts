import { prisma } from "./db";

export type AnalyticsEventType =
  | "VIEW"
  | "UNLOCK"
  | "PURCHASE"
  | "DOWNLOAD"
  | "TIP"
  | "SUBSCRIBE";

export async function recordAnalyticsEvent(input: {
  creatorId: string;
  eventType: AnalyticsEventType;
  contentId?: string;
  burnLinkId?: string;
  walletAddr?: string;
  amountApt?: number;
}) {
  return prisma.analyticsEvent.create({ data: input });
}
