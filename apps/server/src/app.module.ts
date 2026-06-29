import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global JWT guard — all routes require a valid JWT unless decorated with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
