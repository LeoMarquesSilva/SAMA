import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  CardListSkeleton,
} from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={6} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CardListSkeleton count={2} />
        <CardListSkeleton count={2} />
      </div>
    </div>
  );
}
