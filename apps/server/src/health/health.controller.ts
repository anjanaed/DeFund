import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  @Get()
  async check() {
    // --- Database connectivity ---
    let dbStatus: 'connected' | 'error' = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    // --- Indexer state ---
    let lastBlock = 0;
    let lastPollAt: Date | null = null;
    try {
      const state = await this.prisma.indexerState.findUnique({
        where: { id: 'singleton' },
      });
      if (state) {
        lastBlock = state.lastBlock;
        lastPollAt = state.updatedAt;
      }
    } catch {
      // non-fatal — DB already reported error above
    }

    const staleCutoff = new Date(Date.now() - 3 * 60 * 1_000); // 3 minutes
    const isStale = lastPollAt ? lastPollAt < staleCutoff : true;

    // --- RPC reachability ---
    let rpcStatus: 'reachable' | 'error' = 'reachable';
    try {
      await this.blockchain.getCurrentBlock();
    } catch {
      rpcStatus = 'error';
    }

    const overallStatus =
      dbStatus === 'connected' && rpcStatus === 'reachable' && !isStale
        ? 'ok'
        : 'warning';

    return {
      status: overallStatus,
      indexer: {
        lastPollAt,
        lastBlockProcessed: lastBlock,
        isStale,
      },
      database: dbStatus,
      rpc: rpcStatus,
    };
  }
}
