import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { FlagCampaignDto } from './dto/flag-campaign.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @Get('activity')
  getActivity() {
    return this.admin.getActivity();
  }

  @Get('transactions')
  getTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getTransactions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('verification')
  getVerification(@Query('search') search?: string) {
    return this.admin.getVerification(search);
  }

  @Get('projects')
  getProjects() {
    return this.admin.getProjects();
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.admin.getProject(id);
  }

  @Get('projects/:id/financial-summary')
  getFinancialSummary(@Param('id') id: string) {
    return this.admin.getFinancialSummary(id);
  }

  @Post('projects/:id/approve')
  approveCampaign(@Param('id') id: string) {
    return this.admin.approveCampaign(id);
  }

  @Post('projects/:id/reject')
  rejectCampaign(@Param('id') id: string) {
    return this.admin.rejectCampaign(id);
  }

  @Post('projects/:id/flag')
  flagCampaign(@Param('id') id: string, @Body() dto: FlagCampaignDto) {
    return this.admin.flagCampaign(id, dto.reason);
  }

  @Post('projects/:id/block')
  blockCampaign(@Param('id') id: string) {
    return this.admin.blockCampaign(id);
  }

  @Get('milestones')
  getMilestones(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getMilestones(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('milestones/:id')
  getMilestone(@Param('id') id: string) {
    return this.admin.getMilestone(id);
  }

  @Post('milestones/:id/notify-release')
  notifyMilestoneRelease(@Param('id') id: string) {
    return this.admin.notifyMilestoneRelease(id);
  }
}
