import Link from "next/link"
import * as React from "react"

import { SkillinaboxLogo } from "@/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-foreground min-h-svh w-full">
      <div className="grid min-h-svh w-full grid-cols-1 lg:grid-cols-2 lg:grid-rows-1">
        <aside className="relative flex min-h-[min(380px,50svh)] flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 lg:min-h-svh lg:py-12 lg:pl-10 lg:pr-12 xl:pl-16 xl:pr-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-100"
            style={{
              background:
                "linear-gradient(135deg, rgba(242,101,34,0.85) 0%, rgba(32,196,244,0.75) 45%, rgba(253,185,51,0.65) 100%)",
            }}
          />
          <div className="relative z-10 flex flex-col gap-8">
            <ThemeToggle />
            <div className="space-y-4">
              <SkillinaboxLogo variant="full" onDarkBackground className="h-10" />
              <h2 className="font-heading max-w-xl text-2xl leading-tight font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Your events, and progress in one place.
              </h2>
              <p className="text-white/85 max-w-lg text-sm leading-relaxed sm:text-base">
                Pick up where you left off. Sessions Planner keeps your team
                aligned.
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-10 hidden text-[0.65rem] text-white/60 lg:block">
            Skill in a box
          </div>
        </aside>

        <main className="flex min-h-0 flex-col justify-center px-6 py-10 sm:px-12 lg:min-h-svh lg:px-10 lg:py-16 xl:px-16">
          <div className="mx-auto w-full max-w-md lg:max-w-lg">
            <Link
              href="/"
              className="text-muted-foreground hover:text-brand-orange mb-8 inline-flex items-center gap-1 text-sm transition-colors"
            >
              ← Back to home
            </Link>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
