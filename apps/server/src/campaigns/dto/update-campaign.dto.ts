import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goalAmount?: number;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  githubUrl?: string;
}
