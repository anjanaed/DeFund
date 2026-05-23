import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
