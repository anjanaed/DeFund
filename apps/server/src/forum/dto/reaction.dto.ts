import { IsEnum } from 'class-validator';
import { ReactionType } from '../../generated/prisma';

export class ReactionDto {
  @IsEnum(ReactionType)
  type: ReactionType;
}
