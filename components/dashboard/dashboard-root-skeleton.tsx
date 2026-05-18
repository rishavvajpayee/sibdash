import { Separator } from "@/components/ui/separator"

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`bg-muted/60 animate-pulse rounded-md ${className ?? ""}`}
      aria-hidden
    />
  )
}

export function DashboardRootSkeleton() {
  return (
    <div className="bg-background flex min-h-svh">
      <aside className="border-border bg-card hidden w-64 shrink-0 flex-col border-r p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-1">
          <Pulse className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-2 w-16" />
          </div>
        </div>
        <nav className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Pulse key={i} className="h-9 w-full rounded-lg" />
          ))}
        </nav>
        <Separator className="my-6" />
        <Pulse className="mb-2 h-3 w-28" />
        <div className="space-y-2 pr-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Pulse key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <Pulse className="mt-3 h-8 w-full rounded-md" />
        <div className="border-border bg-muted/30 mt-auto rounded-lg border p-3">
          <Pulse className="mb-2 h-3 w-16" />
          <div className="flex items-center gap-2">
            <Pulse className="size-2 shrink-0 rounded-full" />
            <Pulse className="h-3 flex-1 rounded" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md">
          <Pulse className="size-8 shrink-0 rounded-md lg:hidden" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Pulse className="size-5 shrink-0 rounded" />
            <Pulse className="h-6 max-w-[200px] flex-1 rounded" />
          </div>
          <Pulse className="size-9 shrink-0 rounded-md" />
          <Pulse className="h-9 w-[120px] shrink-0 rounded-full" />
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-[1200px] space-y-4">
            <Pulse className="h-8 w-48 max-w-full" />
            <Pulse className="h-4 w-72 max-w-full" />
            <div className="grid gap-4 md:grid-cols-2">
              <Pulse className="h-40 w-full rounded-xl" />
              <Pulse className="h-40 w-full rounded-xl" />
            </div>
            <Pulse className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  )
}
