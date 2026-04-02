import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../generated/prisma';

@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  @Get('projects')
  findAll(@Query() query: QueryCampaignsDto) {
    return this.campaigns.findAll(query);
  }

  @Get('projects/trending')
  findTrending() {
    return this.campaigns.findTrending();
  }

  @Get('projects/:id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Get('projects/:id/milestones')
  findMilestones(@Param('id') id: string) {
    return this.campaigns.findMilestones(id);
  }

  @Get('projects/:id/updates')
  findUpdates(@Param('id') id: string) {
    return this.campaigns.findUpdates(id);
  }

  // ── Creator ───────────────────────────────────────────────────────────────

  @Post('projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  createCampaign(
    @CurrentUser() user: any,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.createCampaign(user.userId, dto);
  }

  @Put('projects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  updateCampaign(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.updateCampaign(id, user.userId, dto);
  }

  @Get('creator/projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  getCreatorProjects(@CurrentUser() user: any) {
    return this.campaigns.findCreatorProjects(user.userId);
  }
}
