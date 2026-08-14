import 'server-only';

import { getOfficialBrawlers } from '@/lib/bs-api';
import { getPrisma } from '@/lib/prisma';
import type { BSBrawler } from '@/types/brawlstars';

/**
 * Game-change detection.
 *
 * The Brawl Stars API publishes no patch notes, changelog or balance feed, so
 * there is nothing to scrape or mirror. What it *does* expose is the current
 * brawler catalogue, including each brawler's star powers, gadgets, gears and
 * hypercharges. Snapshotting that daily and diffing consecutive days yields a
 * real, verifiable feed of roster and kit changes.
 *
 * What this can detect: new brawlers, and new (or removed) abilities on
 * existing ones. What it cannot detect: balance tuning — damage, health and
 * reload numbers are not in the API at all. The UI says so plainly rather than
 * implying it is a full changelog.
 */

export type CatalogChangeKind =
  | 'brawlerAdded'
  | 'brawlerRemoved'
  | 'starPowerAdded'
  | 'gadgetAdded'
  | 'hyperchargeAdded'
  | 'gearAdded'
  | 'abilityRemoved';

interface PendingChange {
  kind: CatalogChangeKind;
  brawlerId: number;
  brawlerName: string;
  itemId: number | null;
  itemName: string | null;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface CatalogRow {
  brawlerId: number;
  brawlerName: string;
  starPowerIds: number[];
  gadgetIds: number[];
  gearIds: number[];
  hyperChargeIds: number[];
}

function toRow(brawler: BSBrawler): CatalogRow {
  return {
    brawlerId: brawler.id,
    brawlerName: brawler.name,
    starPowerIds: (brawler.starPowers ?? []).map((x) => x.id).sort((a, b) => a - b),
    gadgetIds: (brawler.gadgets ?? []).map((x) => x.id).sort((a, b) => a - b),
    gearIds: (brawler.gears ?? []).map((x) => x.id).sort((a, b) => a - b),
    hyperChargeIds: (brawler.hyperCharges ?? []).map((x) => x.id).sort((a, b) => a - b),
  };
}

/**
 * Records today's catalogue and writes any differences from the most recent
 * previous snapshot. Idempotent: re-running on the same day overwrites the
 * snapshot and re-derives the same changes.
 */
export async function snapshotAndDiffCatalog(): Promise<{
  brawlers: number;
  changes: number;
}> {
  const prisma = getPrisma();
  if (!prisma) return { brawlers: 0, changes: 0 };

  const catalogue = (await getOfficialBrawlers()).items;
  if (catalogue.length === 0) return { brawlers: 0, changes: 0 };

  const snapshotDate = todayUtc();
  const rows = catalogue.map(toRow);

  // Previous snapshot: the newest one that is not today's.
  const previousDate = await prisma.brawlerCatalogEntry.findFirst({
    where: { snapshotDate: { lt: snapshotDate } },
    orderBy: { snapshotDate: 'desc' },
    select: { snapshotDate: true },
  });

  const previousRows = previousDate
    ? await prisma.brawlerCatalogEntry.findMany({
        where: { snapshotDate: previousDate.snapshotDate },
      })
    : [];

  // Write today's snapshot before diffing so a crash mid-diff still leaves a
  // usable baseline for tomorrow.
  for (const row of rows) {
    await prisma.brawlerCatalogEntry.upsert({
      where: { brawlerId_snapshotDate: { brawlerId: row.brawlerId, snapshotDate } },
      create: { ...row, snapshotDate },
      update: row,
    });
  }

  // The very first run has nothing to compare against. Recording every
  // existing brawler as "new" would be noise, so it just seeds the baseline.
  if (previousRows.length === 0) return { brawlers: rows.length, changes: 0 };

  const previousById = new Map(previousRows.map((r) => [r.brawlerId, r]));
  const nameById = new Map<number, string>();
  for (const b of catalogue) {
    nameById.set(b.id, b.name);
    for (const a of [
      ...(b.starPowers ?? []),
      ...(b.gadgets ?? []),
      ...(b.hyperCharges ?? []),
      ...(b.gears ?? []),
    ]) {
      nameById.set(a.id, a.name);
    }
  }

  const pending: PendingChange[] = [];

  for (const row of rows) {
    const before = previousById.get(row.brawlerId);

    if (!before) {
      pending.push({
        kind: 'brawlerAdded',
        brawlerId: row.brawlerId,
        brawlerName: row.brawlerName,
        itemId: null,
        itemName: null,
      });
      continue;
    }

    const buckets: [keyof CatalogRow, CatalogChangeKind][] = [
      ['starPowerIds', 'starPowerAdded'],
      ['gadgetIds', 'gadgetAdded'],
      ['hyperChargeIds', 'hyperchargeAdded'],
      ['gearIds', 'gearAdded'],
    ];

    for (const [field, kind] of buckets) {
      const now = row[field] as number[];
      const then = new Set(before[field] as number[]);
      for (const id of now) {
        if (!then.has(id)) {
          pending.push({
            kind,
            brawlerId: row.brawlerId,
            brawlerName: row.brawlerName,
            itemId: id,
            itemName: nameById.get(id) ?? null,
          });
        }
      }

      const nowSet = new Set(now);
      for (const id of before[field] as number[]) {
        if (!nowSet.has(id)) {
          pending.push({
            kind: 'abilityRemoved',
            brawlerId: row.brawlerId,
            brawlerName: row.brawlerName,
            itemId: id,
            itemName: nameById.get(id) ?? null,
          });
        }
      }
    }
  }

  const currentIds = new Set(rows.map((r) => r.brawlerId));
  for (const before of previousRows) {
    if (!currentIds.has(before.brawlerId)) {
      pending.push({
        kind: 'brawlerRemoved',
        brawlerId: before.brawlerId,
        brawlerName: before.brawlerName,
        itemId: null,
        itemName: null,
      });
    }
  }

  let written = 0;
  if (pending.length > 0) {
    const result = await prisma.catalogChange.createMany({
      data: pending.map((c) => ({ ...c, detectedOn: snapshotDate })),
      skipDuplicates: true,
    });
    written = result.count;
  }

  return { brawlers: rows.length, changes: written };
}
