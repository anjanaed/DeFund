import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  getNonce(@Body() dto: NonceRequestDto) {
    return this.authService.getNonce(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifySignature(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto);
  }
}
