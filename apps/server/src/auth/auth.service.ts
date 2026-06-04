import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { randomUUID } from 'crypto';

// Upper bound for the on-chain admin lookup during login. A slow or failing RPC
// must not hang the whole auth flow (which left the admin portal at "Verifying").
const ONCHAIN_ROLE_TIMEOUT_MS = 8000;
// DEFAULT_ADMIN_ROLE in OpenZeppelin AccessControl is bytes32(0).
const DEFAULT_ADMIN_ROLE = `0x${'0'.repeat(64)}`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    // Derive role from the contract — DEFAULT_ADMIN_ROLE on-chain is the source of
    // truth. Time-bounded and guarded so a slow or failing RPC can never hang the
    // login: on timeout/error we fall back to the stored role and let the request
    // complete, instead of leaving the client stuck at "Verifying".
    let role = user.role;
    try {
      const contract = this.blockchain.getContract();
      const isOnChainAdmin = await this.withTimeout(
        contract.hasRole(DEFAULT_ADMIN_ROLE, user.walletAddress),
        ONCHAIN_ROLE_TIMEOUT_MS,
        'hasRole',
      );
      role = isOnChainAdmin ? 'ADMIN' : user.role;
    } catch (err) {
      this.logger.warn(
        `On-chain admin check failed for ${user.walletAddress}; using stored role "${user.role}". ${(err as Error).message}`,
      );
    }

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

  /** Reject if the given promise does not settle within `ms` milliseconds. */
  private async withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`On-chain ${label} timed out after ${ms}ms`)),
        ms,
      );
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
