"use client";

import { motion } from "framer-motion";
import { stagger } from "@/lib/motion";
import { ProjectCard, type ProjectCardData } from "./project-card";

export function ProjectGrid({ projects }: { projects: ProjectCardData[] }) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </motion.div>
  );
}
