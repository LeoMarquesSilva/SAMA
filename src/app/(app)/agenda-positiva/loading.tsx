import {
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-56 rounded-full" />
        <Skeleton className="h-9 w-72 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
