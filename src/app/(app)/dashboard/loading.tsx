import {
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
