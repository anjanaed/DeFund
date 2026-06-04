import { IsEnum, IsString } from 'class-validator';
import { UserRole } from '../../generated/prisma';

export class ProposeRoleChangeDto {
  @IsString()
  targetUserId: string;

  @IsEnum(UserRole)
  targetRole: UserRole;
}
