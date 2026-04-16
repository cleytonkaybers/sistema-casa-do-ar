import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ─── Dark-Navy skeletons for Dashboard ────────────────────────────────────────

export function DashboardStatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-[#152236] border-white/5 rounded-2xl h-full">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-3 h-full">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24 bg-white/10 rounded" />
                <Skeleton className="h-7 w-16 bg-white/10 rounded" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl bg-white/10 shrink-0" />
            </div>
            <div className="pt-2 border-t border-white/5 mt-auto">
              <Skeleton className="h-3 w-20 bg-white/10 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardAdminSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
      {/* ResumoMes skeleton */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl md:col-span-1">
        <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5">
          <Skeleton className="h-4 w-32 bg-white/10 rounded" />
        </CardHeader>
        <CardContent className="p-0 divide-y divide-white/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3">
              <Skeleton className="h-3 w-28 bg-white/10 rounded" />
              <Skeleton className="h-4 w-16 bg-white/10 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* GanhosTecnicos skeleton */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl md:col-span-2">
        <div className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5 flex flex-row items-center justify-between">
          <Skeleton className="h-4 w-36 bg-white/10 rounded" />
          <Skeleton className="h-3 w-20 bg-white/10 rounded" />
        </div>
        {/* Summary row */}
        <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center px-3 py-3 gap-1.5">
              <Skeleton className="h-3 w-14 bg-white/10 rounded" />
              <Skeleton className="h-4 w-20 bg-white/10 rounded" />
              <Skeleton className="h-2 w-16 bg-white/10 rounded" />
            </div>
          ))}
        </div>
        {/* Tech rows */}
        <CardContent className="p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 sm:px-5 py-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28 bg-white/10 rounded" />
                  <Skeleton className="h-3 w-20 bg-white/10 rounded" />
                </div>
                <Skeleton className="h-6 w-20 bg-white/10 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 bg-white/10 rounded" />
                <div className="w-px h-5 bg-white/10" />
                <Skeleton className="h-3 w-16 bg-white/10 rounded" />
                <div className="w-px h-5 bg-white/10" />
                <Skeleton className="h-3 w-16 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── End Dashboard skeletons ───────────────────────────────────────────────────

export function TableSkeleton({ rows = 5 }) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border border-gray-200">
          <CardHeader>
            <Skeleton className="h-5 w-[70%]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[50%]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 8 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="h-3 w-[50%]" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}