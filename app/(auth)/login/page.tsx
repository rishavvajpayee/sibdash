"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  fadeInProps,
  staggerContainer,
  staggerItem,
  useMotionAllowed,
} from "@/lib/motion"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const reduced = useMotionAllowed()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signErr) {
      setError(signErr.message)
      return
    }
    router.replace("/dashboard/schedule")
    router.refresh()
  }

  return (
    <motion.div {...fadeInProps(!reduced)}>
      <motion.div {...staggerContainer(!reduced)}>
        <motion.div {...staggerItem(!reduced)}>
          <Badge
            variant="outline"
            className="border-border mb-3 rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-widest uppercase"
          >
            Sign in
          </Badge>
          <h1 className="font-heading mb-2 text-3xl font-bold tracking-tight">
            Enter your Skill in a box space.
          </h1>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            Continue your learning ops workflow — sessions, trainers, and week
            views stay in sync.
          </p>
        </motion.div>

        <motion.form
          {...staggerItem(!reduced)}
          className="space-y-5"
          onSubmit={onSubmit}
        >
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted/40"
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/signup"
                className="text-brand-orange text-xs font-medium hover:underline"
              >
                New here? Create an account
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted/40"
            />
          </div>
          <Button
            type="submit"
            className="from-brand-orange via-brand-cyan to-brand-yellow h-11 w-full rounded-xl bg-gradient-to-r font-semibold shadow-md"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </motion.form>
      </motion.div>
    </motion.div>
  )
}
