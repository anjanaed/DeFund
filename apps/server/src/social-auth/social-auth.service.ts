import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface StateEntry {
  userId: string;
  codeVerifier?: string;
  expiresAt: number;
}

@Injectable()
export class SocialAuthService {
  private readonly states = new Map<string, StateEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private newState(userId: string, codeVerifier?: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    this.states.set(state, { userId, codeVerifier, expiresAt: Date.now() + 600_000 });
    for (const [k, v] of this.states) {
      if (v.expiresAt < Date.now()) this.states.delete(k);
    }
    return state;
  }

  private consumeState(state: string): StateEntry {
    const entry = this.states.get(state);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    this.states.delete(state);
    return entry;
  }

  // ── GitHub ───────────────────────────────────────────────────────────────

  githubUrl(userId: string): string {
    const state = this.newState(userId);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: process.env.GITHUB_REDIRECT_URI!,
      scope: 'read:user',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async githubCallback(code: string, state: string): Promise<string> {
    const { userId } = this.consumeState(state);

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
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) throw new Error('GitHub token exchange failed');

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'DeFund' },
    });
    const profile = await profileRes.json() as any;

    await this.prisma.user.update({ where: { id: userId }, data: { githubHandle: profile.login } });
    return profile.login as string;
  }

  // ── Discord ──────────────────────────────────────────────────────────────

  discordUrl(userId: string): string {
    const state = this.newState(userId);
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
    const { userId } = this.consumeState(state);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }).toString(),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) throw new Error('Discord token exchange failed');

    const profileRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as any;
    const username: string = profile.global_name || profile.username;

    await this.prisma.user.update({ where: { id: userId }, data: { discordHandle: username } });
    return username;
  }

  // ── Twitter / X — OAuth 2.0 + PKCE ───────────────────────────────────────

  twitterUrl(userId: string): string {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = this.newState(userId, codeVerifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: process.env.TWITTER_REDIRECT_URI!,
      scope: 'users.read tweet.read',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async twitterCallback(code: string, state: string): Promise<string> {
    const { userId, codeVerifier } = this.consumeState(state);

    const basicAuth = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`,
    ).toString('base64');

    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
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
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) throw new Error('Twitter token exchange failed');

    const profileRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as any;
    const username: string = profile.data?.username;

    await this.prisma.user.update({ where: { id: userId }, data: { twitterHandle: username } });
    return username;
  }
}
