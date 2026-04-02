import { IsString, MinLength } from 'class-validator';

export class SubmitProofDto {
  @IsString()
  @MinLength(1)
  proofUrl: string;
}
