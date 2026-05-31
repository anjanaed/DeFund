import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

const OSS_LICENSES = [
  'MIT', 'Apache-2.0', 'GPL-3.0', 'AGPL-3.0', 'GPL-2.0',
  'LGPL-2.1', 'MPL-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Other',
];

export class CreateMilestoneDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class CreateCampaignDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  category: string;

  @IsNumber()
  @Min(0)
  goalAmount: number;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsNotEmpty()
  @IsUrl()
  repositoryUrl: string;

  @IsOptional()
  @IsIn(OSS_LICENSES)
  license?: string;

  @IsOptional()
  @IsInt()
  onChainId?: number;

  @IsOptional()
  @IsString()
  transactionHash?: string;

  @IsOptional()
  @IsString()
  paymentToken?: string;

  @IsOptional()
  @IsString()
  ipfsHash?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  milestones: CreateMilestoneDto[];
}
