import {
  ProfileHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/ui/skeletons';

export default function ClubLoading() {
  return (
    <div className="space-y-8">
      <ProfileHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <section>
        <div className="skeleton mb-4 h-8 w-32" />
        <TableSkeleton rows={8} />
      </section>
    </div>
  );
}
