import {
  BattleLogSkeleton,
  BrawlerGridSkeleton,
  ProfileHeaderSkeleton,
  StatGridSkeleton,
} from "@/components/ui/skeletons";

export default function PlayerLoading() {
  return (
    <div className="space-y-8">
      <ProfileHeaderSkeleton />
      <StatGridSkeleton />
      <section>
        <div className="skeleton mb-4 h-8 w-44" />
        <BattleLogSkeleton />
      </section>
      <section>
        <div className="skeleton mb-4 h-8 w-32" />
        <BrawlerGridSkeleton />
      </section>
    </div>
  );
}
