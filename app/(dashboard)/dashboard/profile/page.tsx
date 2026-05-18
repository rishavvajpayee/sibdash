"use client"

import { motion } from "framer-motion"
import * as React from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { fadeInProps, staggerContainer, staggerItem, useMotionAllowed } from "@/lib/motion"
import { toast } from "sonner"

const schema = z
  .object({
    password: z.string().min(6, "At least 6 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })

export default function ProfilePage() {
  const reduced = useMotionAllowed()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [email, setEmail] = React.useState<string | null>(null)

  React.useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = schema.safeParse({ password, confirm })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Password updated")
    setPassword("")
    setConfirm("")
  }

  return (
    <motion.div {...fadeInProps(!reduced)} className="mx-auto max-w-md">
      <motion.div {...staggerContainer(!reduced)}>
        <motion.div {...staggerItem(!reduced)}>
          <h1 className="font-heading mb-2 text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">{email}</span>
          </p>
        </motion.div>

        <motion.div {...staggerItem(!reduced)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="newpw">New password</Label>
                  <Input
                    id="newpw"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confpw">Confirm password</Label>
                  <Input
                    id="confpw"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="bg-muted/40"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
