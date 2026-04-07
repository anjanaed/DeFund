import { IsEnum } from 'class-validator';
import { UserRole } from '../../generated/prisma';

export class SetUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
