import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { MilestonesModule } from './milestones/milestones.module';
import { ForumModule } from './forum/forum.module';
import { StatsModule } from './stats/stats.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { SocialAuthModule } from './social-auth/social-auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { IpfsModule } from './ipfs/ipfs.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // M2 — global rate limiting (10 requests per 60 s per IP by default)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    BlockchainModule,
    AuthModule,
    CampaignsModule,
    MilestonesModule,
    ForumModule,
    StatsModule,
    UsersModule,
    AdminModule,
    SocialAuthModule,
    NotificationsModule,
    HealthModule,
    IpfsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Activates the global throttler guard so @Throttle() decorators are enforced
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
