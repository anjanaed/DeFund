import { Body, Controller, Get, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('user')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.users.getMe(user.userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any) {
    return this.users.getDashboard(user.userId);
  }

  @Get('contributions')
  getContributions(@CurrentUser() user: any) {
    return this.users.getContributions(user.userId);
  }

  @Get('voting-required')
  getVotingRequired(@CurrentUser() user: any) {
    return this.users.getVotingRequired(user.userId);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: any) {
    return this.users.getTransactions(user.userId);
  }

  @Get('reclaimable')
  getReclaimable(@CurrentUser() user: any) {
    return this.users.getReclaimable(user.userId);
  }
}
