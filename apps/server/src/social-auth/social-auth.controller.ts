import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from './social-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('auth')
export class SocialAuthController {
  private readonly frontendOrigin: string;
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly svc: SocialAuthService,
    private readonly config: ConfigService,
  ) {
    this.frontendOrigin = this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
  }

  private popupHtml(provider: string, username: string | null, error?: string): string {
    const payload = username
      ? { provider, username, success: true }
      : { provider, success: false, error: error ?? 'Verification failed' };
    return `<!DOCTYPE html><html><body>
      <script>
        window.opener && window.opener.postMessage(${JSON.stringify(payload)}, '${this.frontendOrigin}');
        window.close();
      </script>
      <p style="font-family:sans-serif;text-align:center;margin-top:60px">
        ${username ? 'Verified! You can close this window.' : 'Verification failed. You can close this window.'}
      </p>
    </body></html>`;
  }

  // ── GitHub ───────────────────────────────────────────────────────────────

  @Get('github/initiate')
  @UseGuards(JwtAuthGuard)
  githubInitiate(@CurrentUser() user: any) {
    return { url: this.svc.githubUrl(user.walletAddress) };
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const username = await this.svc.githubCallback(code, state);
      res.send(this.popupHtml('github', username));
    } catch (err) {
      this.logger.error('GitHub callback error', err instanceof Error ? err.message : err);
      res.send(this.popupHtml('github', null, err instanceof Error ? err.message : 'GitHub verification failed'));
    }
  }

  // ── Discord ──────────────────────────────────────────────────────────────

  @Get('discord/initiate')
  @UseGuards(JwtAuthGuard)
  discordInitiate(@CurrentUser() user: any) {
    return { url: this.svc.discordUrl(user.walletAddress) };
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const username = await this.svc.discordCallback(code, state);
      res.send(this.popupHtml('discord', username));
    } catch (err) {
      this.logger.error('Discord callback error', err instanceof Error ? err.message : err);
      res.send(this.popupHtml('discord', null, err instanceof Error ? err.message : 'Discord verification failed'));
    }
  }

  // ── Twitter / X ──────────────────────────────────────────────────────────

  @Get('twitter/initiate')
  @UseGuards(JwtAuthGuard)
  twitterInitiate(@CurrentUser() user: any) {
    return { url: this.svc.twitterUrl(user.walletAddress) };
  }

  @Get('twitter/callback')
  async twitterCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const username = await this.svc.twitterCallback(code, state);
      res.send(this.popupHtml('twitter', username));
    } catch (err) {
      this.logger.error('Twitter callback error', err instanceof Error ? err.message : err);
      res.send(this.popupHtml('twitter', null, err instanceof Error ? err.message : 'Twitter verification failed'));
    }
  }
}
