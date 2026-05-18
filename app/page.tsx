import Link from "next/link"
import { redirect } from "next/navigation"

import { SkillinaboxLogo } from "@/brand/logo"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard/schedule")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <SkillinaboxLogo variant="full" className="h-10 text-foreground" />
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed">
        Sessions Planner for Skill in a box — sign in to manage schedules with
        live Supabase sync.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild className="rounded-xl shadow-md">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    </div>
  )
}
