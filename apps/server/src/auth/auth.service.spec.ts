import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';

const mockUser = {
  id: 'user-uuid-1',
  walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
  nonce: 'Sign this message to authenticate with DeFund: some-uuid',
  role: 'USER',
};

const mockContract = {
  DEFAULT_ADMIN_ROLE: jest.fn(),
  hasRole: jest.fn(),
};

const mockPrisma = {
  user: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockBlockchain = {
  verifyMessage: jest.fn(),
  getContract: jest.fn(),
};

const mockJwt = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockBlockchain.getContract.mockReturnValue(mockContract);
    mockContract.DEFAULT_ADMIN_ROLE.mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000');
    mockContract.hasRole.mockResolvedValue(false);
    mockJwt.sign.mockReturnValue('mock-jwt-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('getNonce', () => {
    it('returns a nonce with the DeFund prefix', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      const result = await service.getNonce({ walletAddress: '0xABCDEF' });

      expect(result.nonce).toMatch(/^Sign this message to authenticate with DeFund:/);
    });

    it('stores the wallet address as lowercase', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      await service.getNonce({ walletAddress: '0xABCDEF1234' });

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: '0xabcdef1234' },
        }),
      );
    });

    it('generates a unique nonce on each call', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      const [r1, r2] = await Promise.all([
        service.getNonce({ walletAddress: '0x1234' }),
        service.getNonce({ walletAddress: '0x1234' }),
      ]);

      expect(r1.nonce).not.toBe(r2.nonce);
    });

    it('upserts the user (create or update)', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      await service.getNonce({ walletAddress: '0xabc' });

      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifySignature', () => {
    const dto = { walletAddress: mockUser.walletAddress, signature: '0xsignature' };

    it('throws BadRequestException when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifySignature(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user has no pending nonce', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, nonce: null });

      await expect(service.verifySignature(dto)).rejects.toThrow(BadRequestException);
      await expect(service.verifySignature(dto)).rejects.toThrow('No pending nonce for this address');
    });

    it('throws UnauthorizedException when blockchain.verifyMessage throws', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockImplementation(() => { throw new Error('invalid signature'); });

      await expect(service.verifySignature(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when recovered address does not match wallet', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockReturnValue('0xdifferentaddress');

      await expect(service.verifySignature(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.verifySignature(dto)).rejects.toThrow('Signature does not match wallet address');
    });

    it('returns accessToken and user on valid signature for regular user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockReturnValue(mockUser.walletAddress);
      mockContract.hasRole.mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, nonce: null, role: 'USER' });

      const result = await service.verifySignature(dto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.walletAddress).toBe(mockUser.walletAddress);
      expect(result.user.role).toBe('USER');
    });

    it('assigns ADMIN role when the address holds DEFAULT_ADMIN_ROLE on-chain', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockReturnValue(mockUser.walletAddress);
      mockContract.hasRole.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: 'ADMIN' });

      const result = await service.verifySignature(dto);

      expect(result.user.role).toBe('ADMIN');
    });

    it('clears the nonce after verification to prevent replay attacks', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockReturnValue(mockUser.walletAddress);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, nonce: null });

      await service.verifySignature(dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nonce: null }),
        }),
      );
    });

    it('signs JWT with correct sub, walletAddress, and role fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBlockchain.verifyMessage.mockReturnValue(mockUser.walletAddress);
      mockContract.hasRole.mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.verifySignature(dto);

      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        walletAddress: mockUser.walletAddress,
        role: 'USER',
      });
    });

    it('performs case-insensitive address comparison', async () => {
      const upperDto = { walletAddress: mockUser.walletAddress.toUpperCase(), signature: '0xsig' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      // verifyMessage returns mixed-case but lowercased comparison should still match
      mockBlockchain.verifyMessage.mockReturnValue(mockUser.walletAddress.toUpperCase());
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.verifySignature(upperDto);

      expect(result.user).toBeDefined();
    });
  });
});
