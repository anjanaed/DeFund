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
import { CreateUpdateDto } from './dto/create-update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  @Get('stats')
  getPublicStats() {
    return this.campaigns.getPublicStats();
  }

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
  @UseGuards(JwtAuthGuard)
  createCampaign(
    @CurrentUser() user: any,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.createCampaign(user.userId, dto);
  }

  @Put('projects/:id')
  @UseGuards(JwtAuthGuard)
  updateCampaign(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.updateCampaign(id, user.userId, dto);
  }

  @Post('projects/:id/updates')
  @UseGuards(JwtAuthGuard)
  createUpdate(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateUpdateDto,
  ) {
    return this.campaigns.createUpdate(id, user.userId, dto);
  }

  @Get('creator/projects')
  @UseGuards(JwtAuthGuard)
  getCreatorProjects(@CurrentUser() user: any) {
    return this.campaigns.findCreatorProjects(user.userId);
  }
}
