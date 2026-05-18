function Bar({ className }: { className?: string }) {
  return (
    <div
      className={`bg-muted/60 animate-pulse rounded-md ${className ?? ""}`}
      aria-hidden
    />
  )
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-8 w-56 max-w-full" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Bar className="h-9 w-28 rounded-lg" />
        <Bar className="h-9 w-32 rounded-lg" />
        <Bar className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Bar className="h-36 rounded-xl lg:col-span-2" />
        <Bar className="h-36 rounded-xl" />
      </div>
      <Bar className="h-72 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Bar className="h-24 rounded-lg" />
        <Bar className="h-24 rounded-lg" />
      </div>
    </div>
  )
}
