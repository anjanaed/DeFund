import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class VerifySignatureDto {
  @IsNotEmpty()
  @IsEthereumAddress()
  walletAddress: string;

  @IsNotEmpty()
  @IsString()
  signature: string;
}
