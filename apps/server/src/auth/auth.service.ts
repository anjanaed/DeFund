import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly jwt: JwtService,
  ) {}

  async getNonce(dto: NonceRequestDto): Promise<{ nonce: string }> {
    const nonce = `Sign this message to authenticate with DeFund: ${randomUUID()}`;

    await this.prisma.user.upsert({
      where: { walletAddress: dto.walletAddress.toLowerCase() },
      update: { nonce },
      create: { walletAddress: dto.walletAddress.toLowerCase(), nonce },
    });

    return { nonce };
  }

  async verifySignature(
    dto: VerifySignatureDto,
  ): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: dto.walletAddress.toLowerCase() },
    });

    if (!user || !user.nonce) {
      throw new BadRequestException('No pending nonce for this address');
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = this.blockchain.verifyMessage(
        user.nonce,
        dto.signature,
      );
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }

    if (recoveredAddress.toLowerCase() !== dto.walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Signature does not match wallet address');
    }

    // Clear nonce to prevent replay attacks
    await this.prisma.user.update({
      where: { id: user.id },
      data: { nonce: null },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return { accessToken };
  }
}
