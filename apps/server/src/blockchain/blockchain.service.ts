import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly abi: any[];
  private readonly contractAddress: string;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('sepoliaRpcUrl');
    this.contractAddress = this.config.get<string>('campaignFactoryAddress') ?? '';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // In dist/src/blockchain/, __dirname resolves 4 levels up to the monorepo root
    const artifactPath = join(
      __dirname,
      '../../../../blockchain/artifacts/contracts/CampaignFactory.sol/CampaignFactory.json',
    );
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    this.abi = artifact.abi;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getContract(): ethers.Contract {
    return new ethers.Contract(this.contractAddress, this.abi, this.provider);
  }

  getContractWithSigner(privateKey: string): ethers.Contract {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    return new ethers.Contract(this.contractAddress, this.abi, wallet);
  }

  verifyMessage(message: string, signature: string): string {
    return ethers.verifyMessage(message, signature);
  }

  async getCurrentBlock(): Promise<number> {
    return this.provider.getBlockNumber();
  }
}
