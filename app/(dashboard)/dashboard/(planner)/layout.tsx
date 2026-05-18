"use client"

import { motion } from "framer-motion"
import * as React from "react"

import { fadeInProps, useMotionAllowed } from "@/lib/motion"

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reduced = useMotionAllowed()

  return (
    <motion.div {...fadeInProps(!reduced)} className="mx-auto max-w-[1200px]">
      {children}
    </motion.div>
  )
}
