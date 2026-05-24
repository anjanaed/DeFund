import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';

const makeMilestone = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'milestone-1',
  title: 'Milestone 1',
  status: 'PENDING',
  proofUrl: null,
  campaignId: 'campaign-1',
  campaign: { creatorId: 'user-1' },
  ...overrides,
});

const mockPrisma = {
  milestone: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn(),
};

describe('MilestonesService', () => {
  let service: MilestonesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue('https://ipfs.io/ipfs/');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  describe('getProof', () => {
    it('throws NotFoundException when milestone does not exist', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.getProof('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns milestone as-is when proofUrl is null', async () => {
      const milestone = makeMilestone({ proofUrl: null });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBeNull();
    });

    it('returns milestone as-is when proofUrl is already a full URL', async () => {
      const milestone = makeMilestone({ proofUrl: 'https://example.com/proof.pdf' });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBe('https://example.com/proof.pdf');
    });

    it('prepends IPFS gateway when proofUrl starts with Qm (CIDv0)', async () => {
      const milestone = makeMilestone({ proofUrl: 'QmXyz123abc' });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBe('https://ipfs.io/ipfs/QmXyz123abc');
    });

    it('prepends IPFS gateway when proofUrl starts with bafy (CIDv1)', async () => {
      const milestone = makeMilestone({ proofUrl: 'bafybeiabc123' });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBe('https://ipfs.io/ipfs/bafybeiabc123');
    });

    it('uses default IPFS gateway when config returns undefined', async () => {
      mockConfig.get.mockReturnValue(undefined);
      const milestone = makeMilestone({ proofUrl: 'QmTest' });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBe('https://ipfs.io/ipfs/QmTest');
    });

    it('uses custom IPFS gateway from config', async () => {
      mockConfig.get.mockReturnValue('https://gateway.pinata.cloud/ipfs/');
      const milestone = makeMilestone({ proofUrl: 'QmTest' });
      mockPrisma.milestone.findUnique.mockResolvedValue(milestone);

      const result = await service.getProof('milestone-1');

      expect(result.proofUrl).toBe('https://gateway.pinata.cloud/ipfs/QmTest');
    });
  });

  describe('submitProof', () => {
    const dto = { proofUrl: 'QmProofHash123' };

    it('updates the milestone proofUrl for the campaign creator', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(makeMilestone());
      const updated = makeMilestone({ proofUrl: dto.proofUrl });
      mockPrisma.milestone.update.mockResolvedValue(updated);

      const result = await service.submitProof('milestone-1', 'user-1', dto);

      expect(result.proofUrl).toBe(dto.proofUrl);
      expect(mockPrisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'milestone-1' },
        data: { proofUrl: dto.proofUrl },
      });
    });

    it('throws NotFoundException when milestone does not exist', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(null);

      await expect(service.submitProof('bad-id', 'user-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the campaign creator', async () => {
      mockPrisma.milestone.findUnique.mockResolvedValue(
        makeMilestone({ campaign: { creatorId: 'real-creator' } }),
      );

      await expect(service.submitProof('milestone-1', 'intruder', dto)).rejects.toThrow(ForbiddenException);
    });
  });
});
