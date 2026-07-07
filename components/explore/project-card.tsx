"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { formatApt } from "@/lib/utils";
import { getShelbyPublicUrl } from "@/lib/shelby";
import { ShareBurnLink } from "@/components/burnlink/share-burnlink";

export interface ProjectCardData {
  id: string;
  title: string;
  thumbnailUrl: string;
  thumbnailCid?: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  likes: number;
  views: number;
  priceApt?: number;
  accessLevel?: number;
  verified?: boolean;
  slug?: string;
  href?: string;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const thumb = project.thumbnailCid
    ? getShelbyPublicUrl(project.thumbnailCid)
    : project.thumbnailUrl;

  const href =
    project.href ||
    (project.slug ? `/b/${project.slug}` : `/${project.creatorHandle}`);

  return (
    <motion.article variants={fadeUp} className="group">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[var(--bg-subtle)]">
          <Image
            src={thumb || "/logo.png"}
            alt={project.title}
            fill
            className="object-cover transition-opacity duration-200 group-hover:opacity-95"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {project.creatorName}
            </span>
            {project.verified && (
              <span className="badge badge-pro shrink-0">Pro</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {formatCount(project.likes)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCount(project.views)}
            </span>
          </div>
        </div>
        {project.priceApt !== undefined && project.priceApt > 0 && (
          <p className="mt-0.5 text-xs font-medium text-[var(--accent)]">
            {formatApt(project.priceApt, 2)}
          </p>
        )}
      </Link>
      {project.slug && (
        <div className="mt-2" onClick={(e) => e.preventDefault()}>
          <ShareBurnLink slug={project.slug} compact />
        </div>
      )}
    </motion.article>
  );
}
