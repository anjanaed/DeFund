import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from './social-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('auth')
export class SocialAuthController {
  private readonly frontendOrigin: string;

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
    return { url: this.svc.githubUrl(user.userId) };
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
    } catch {
      res.send(this.popupHtml('github', null, 'GitHub verification failed'));
    }
  }

  // ── Discord ──────────────────────────────────────────────────────────────

  @Get('discord/initiate')
  @UseGuards(JwtAuthGuard)
  discordInitiate(@CurrentUser() user: any) {
    return { url: this.svc.discordUrl(user.userId) };
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
    } catch {
      res.send(this.popupHtml('discord', null, 'Discord verification failed'));
    }
  }

  // ── Twitter / X ──────────────────────────────────────────────────────────

  @Get('twitter/initiate')
  @UseGuards(JwtAuthGuard)
  twitterInitiate(@CurrentUser() user: any) {
    return { url: this.svc.twitterUrl(user.userId) };
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
    } catch {
      res.send(this.popupHtml('twitter', null, 'Twitter verification failed'));
    }
  }
}
