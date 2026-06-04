import { IsString, MinLength } from 'class-validator';

export class FlagCampaignDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
