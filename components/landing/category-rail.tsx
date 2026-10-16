"use client";

import Image from "next/image";
import Link from "next/link";
import { PHOTOS, photoUrl, type PhotoKey } from "@/lib/photos";

const CATEGORIES: { key: PhotoKey; title: string; modality: string; blurb: string }[] = [
  { key: "robotics", title: "Robotics", modality: "ROBOTICS", blurb: "Teleoperation episodes, grasping, manipulation" },
  { key: "pov", title: "First-person video", modality: "VIDEO", blurb: "Egocentric footage of real tasks" },
  { key: "autonomous", title: "Driving & sensors", modality: "SENSOR", blurb: "Camera, lidar and telemetry logs" },
  { key: "audio", title: "Speech & audio", modality: "AUDIO", blurb: "Consented voices, accents, environments" },
  { key: "medical", title: "Imaging", modality: "IMAGE", blurb: "Annotated scans and specialist imagery" },
  { key: "satellite", title: "Geospatial", modality: "GEOSPATIAL", blurb: "Earth observation and mapping" },
  { key: "research", title: "Expert text", modality: "TEXT", blurb: "Domain writing, transcripts, Q&A" },
  { key: "datacenter", title: "Tabular", modality: "TABULAR", blurb: "Structured records and time series" },
];

export function CategoryRail() {
  const loop = [...CATEGORIES, ...CATEGORIES];
  return (
    <section className="py-28">
      <div className="mx-auto max-w-[1080px] px-5">
        <p className="eyebrow">What people license</p>
        <h2 className="display-xl mt-3 max-w-[18ch]">The data the open web never had.</h2>
        <p className="lede mt-4 max-w-2xl">
          Real-world, first-party data, recorded, curated and owned by the people selling it.
        </p>
      </div>
      <div className="group relative mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        <div className="animate-marquee flex w-max gap-4 px-5 group-hover:[animation-play-state:paused]">
          {loop.map((c, i) => (
            <Link
              key={`${c.key}-${i}`}
              href={`/datasets?modality=${c.modality}`}
              className="relative block h-[360px] w-[280px] shrink-0 overflow-hidden rounded-[28px] bg-[var(--bg-inset)] transition-transform duration-500 hover:scale-[1.02]"
              aria-label={c.title}
              tabIndex={i >= CATEGORIES.length ? -1 : 0}
            >
              <Image src={photoUrl(PHOTOS[c.key], 700, 75)} alt={PHOTOS[c.key].alt} fill sizes="280px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="text-[21px] font-semibold tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-1 text-[14px] text-white/75">{c.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
