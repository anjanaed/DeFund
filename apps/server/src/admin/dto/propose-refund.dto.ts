import { IsString, MaxLength } from 'class-validator';

export class ProposeRefundDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
