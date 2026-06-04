import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { IndexerService } from './indexer.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [BlockchainService, IndexerService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
