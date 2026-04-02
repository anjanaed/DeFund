import { IsEthereumAddress, IsNotEmpty } from 'class-validator';

export class NonceRequestDto {
  @IsNotEmpty()
  @IsEthereumAddress()
  walletAddress: string;
}
