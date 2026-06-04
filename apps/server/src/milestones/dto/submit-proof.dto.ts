import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SubmitProofDto {
  @IsString()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MinLength(1)
  @MaxLength(2048)
  proofUrl: string;
}
