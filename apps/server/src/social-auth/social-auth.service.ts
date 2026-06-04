import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface StatePayload {
  walletAddress: string;
  codeVerifier?: string;
  exp: number;
}

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private signState(walletAddress: string, codeVerifier?: string): string {
    const payload = Buffer.from(
      JSON.stringify({ walletAddress, codeVerifier, exp: Date.now() + 600_000 }),
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'fallback-dev-secret')
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): { walletAddress: string; codeVerifier?: string } {
    const dot = state.lastIndexOf('.');
    if (dot === -1) throw new UnauthorizedException('Invalid OAuth state');
    const payload = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expectedSig = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'fallback-dev-secret')
      .update(payload)
      .digest('base64url');
    if (sig !== expectedSig) throw new UnauthorizedException('Invalid OAuth state signature');
    let data: StatePayload;
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Malformed OAuth state');
    }
    if (data.exp < Date.now()) throw new UnauthorizedException('Expired OAuth state');
    return { walletAddress: data.walletAddress, codeVerifier: data.codeVerifier };
  }

  // ── GitHub ────────────────────────────────────────────────────────────────

  githubUrl(walletAddress: string): string {
    const state = this.signState(walletAddress);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: process.env.GITHUB_REDIRECT_URI!,
      scope: 'read:user',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async githubCallback(code: string, state: string): Promise<string> {
    const { walletAddress } = this.verifyState(state);

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) {
      this.logger.error('GitHub token exchange failed', tokenData);
      throw new Error(
        `GitHub token exchange failed: ${tokenData.error_description || tokenData.error || JSON.stringify(tokenData)}`,
      );
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'DeFund' },
    });
    const profile = (await profileRes.json()) as any;
    if (!profile.login) {
      this.logger.error('GitHub profile fetch failed', profile);
      throw new Error('Failed to fetch GitHub profile');
    }

    await this.prisma.user.update({
      where: { walletAddress },
      data: { githubHandle: profile.login },
    });
    return profile.login as string;
  }

  // ── Discord ───────────────────────────────────────────────────────────────

  discordUrl(walletAddress: string): string {
    const state = this.signState(walletAddress);
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      response_type: 'code',
      scope: 'identify',
      state,
    });
    return `https://discord.com/oauth2/authorize?${params}`;
  }

  async discordCallback(code: string, state: string): Promise<string> {
    const { walletAddress } = this.verifyState(state);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.DISCORD_CLIENT_ID}:${process.env.DISCORD_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) {
      this.logger.error('Discord token exchange failed', tokenData);
      throw new Error(
        `Discord token exchange failed: ${tokenData.error_description || tokenData.error || JSON.stringify(tokenData)}`,
      );
    }

    const profileRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as any;
    if (!profile.id) {
      this.logger.error('Discord profile fetch failed', profile);
      throw new Error('Failed to fetch Discord profile');
    }
    const username: string = profile.global_name || profile.username;

    await this.prisma.user.update({
      where: { walletAddress },
      data: { discordHandle: username },
    });
    return username;
  }

  // ── Twitter / X — OAuth 2.0 + PKCE ───────────────────────────────────────

  twitterUrl(walletAddress: string): string {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = this.signState(walletAddress, codeVerifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: process.env.TWITTER_REDIRECT_URI!,
      scope: 'users.read tweet.read',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://x.com/i/oauth2/authorize?${params}`;
  }

  async twitterCallback(code: string, state: string): Promise<string> {
    const { walletAddress, codeVerifier } = this.verifyState(state);

    const basicAuth = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`,
    ).toString('base64');

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.TWITTER_REDIRECT_URI!,
        code_verifier: codeVerifier!,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) {
      this.logger.error('Twitter token exchange failed', tokenData);
      throw new Error(
        `Twitter token exchange failed: ${tokenData.error_description || tokenData.error || JSON.stringify(tokenData)}`,
      );
    }

    const profileRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as any;
    const username: string = profile.data?.username;
    if (!username) {
      this.logger.error('Twitter profile fetch failed', profile);
      throw new Error('Failed to fetch Twitter profile');
    }

    await this.prisma.user.update({
      where: { walletAddress },
      data: { twitterHandle: username },
    });
    return username;
  }
}
