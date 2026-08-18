import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '/home/jpn/brawlstats/src/generated/prisma/client';
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
async function main(){
  const total = await prisma.sampledPlayer.count();
  const withElo = await prisma.sampledPlayer.count({ where:{ rankedElo:{ not:null } } });
  const above750 = await prisma.sampledPlayer.count({ where:{ rankedElo:{ gt:750 } } });
  const at750 = await prisma.sampledPlayer.count({ where:{ rankedElo:750 } });
  const zero = await prisma.sampledPlayer.count({ where:{ rankedElo:0 } });
  const sampledEver = await prisma.sampledPlayer.count({ where:{ lastSampledAt:{ not:null } } });
  console.log({ total, sampledEver, withElo, above750, at750, zero });

  const cur = await prisma.sampledPlayer.groupBy({ by:['rankedRankName'], _count:{_all:true}, where:{ rankedRankName:{not:null} } });
  console.log('\nCURRENT rank distribution (all rows with a name):');
  for (const g of cur.sort((a,b)=>b._count._all-a._count._all)) console.log('  ', String(g.rankedRankName).padEnd(16), g._count._all);

  const peak = await prisma.sampledPlayer.groupBy({ by:['highestRankedRankName'], _count:{_all:true}, where:{ highestRankedRankName:{not:null} } });
  console.log('\nPEAK rank distribution:');
  for (const g of peak.sort((a,b)=>b._count._all-a._count._all)) console.log('  ', String(g.highestRankedRankName).padEnd(16), g._count._all);
}
main().finally(()=>prisma.$disconnect());
