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

export default function SignupPage() {
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
    const { error: signErr } = await supabase.auth.signUp({
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
            Create account
          </Badge>
          <h1 className="font-heading mb-2 text-3xl font-bold tracking-tight">
            Join your team workspace.
          </h1>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            Simple email and password — no invitation emails required when email
            confirmation is disabled in Supabase.
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
            <Label htmlFor="su-email">Email</Label>
            <Input
              id="su-email"
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
            <Label htmlFor="su-password">Password</Label>
            <Input
              id="su-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
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
            {loading ? "Creating…" : "Create account"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-orange font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.form>
      </motion.div>
    </motion.div>
  )
}
