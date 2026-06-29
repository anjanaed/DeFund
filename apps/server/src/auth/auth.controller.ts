import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — matches JWT expiry
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // M2 — rate-limit nonce generation to 5 requests per minute per IP
  // to prevent spam / wallet-slot exhaustion attacks.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  getNonce(@Body() dto: NonceRequestDto) {
    return this.authService.getNonce(dto);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifySignature(
    @Body() dto: VerifySignatureDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.authService.verifySignature(dto);
    res.cookie('jwt', accessToken, COOKIE_OPTIONS);
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return { user };
  }
}
