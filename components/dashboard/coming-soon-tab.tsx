"use client"

import { motion } from "framer-motion"
import { Construction } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fadeInProps, useMotionAllowed } from "@/lib/motion"

export function ComingSoonTab({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const reduced = useMotionAllowed()
  return (
    <motion.div {...fadeInProps(!reduced)}>
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-lg">
            <Construction className="text-brand-orange size-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
            {description}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
