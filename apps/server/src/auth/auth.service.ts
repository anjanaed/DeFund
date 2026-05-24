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
  ): Promise<{ accessToken: string; user: { id: string; walletAddress: string; role: string } }> {
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

    // Derive role from the contract — DEFAULT_ADMIN_ROLE on-chain is the source of truth.
    const contract = this.blockchain.getContract();
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    const isOnChainAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, user.walletAddress);
    const role = isOnChainAdmin ? 'ADMIN' : user.role;

    // Clear nonce to prevent replay attacks and sync DB role with contract.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { nonce: null, role: role as any },
    });

    const accessToken = this.jwt.sign({
      sub: user.id,
      walletAddress: user.walletAddress,
      role,
    });

    return {
      accessToken,
      user: { id: user.id, walletAddress: user.walletAddress, role },
    };
  }
}
