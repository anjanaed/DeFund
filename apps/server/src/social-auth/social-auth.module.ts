import { Module } from '@nestjs/common';
import { SocialAuthController } from './social-auth.controller';
import { SocialAuthService } from './social-auth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SocialAuthController],
  providers: [SocialAuthService],
})
export class SocialAuthModule {}
