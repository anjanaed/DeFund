import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { FlagCampaignDto } from './dto/flag-campaign.dto';
import { ProposeRoleChangeDto } from './dto/propose-role-change.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { ProposeRefundDto } from './dto/propose-refund.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
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
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.getTransactions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      status,
    );
  }

  @Get('verification')
  getVerification(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getVerification(search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
  }

  @Get('projects')
  getProjects(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.getProjects(page ? parseInt(page) : 1, limit ? parseInt(limit) : 20, status, search);
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
  approveCampaign(
    @Param('id') id: string,
    @Body() body: { onChainId: number },
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.approveCampaignAudited(id, body.onChainId, user.walletAddress);
  }

  @Post('projects/:id/reject')
  rejectCampaign(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.rejectCampaignAudited(id, user.walletAddress);
  }

  @Post('projects/:id/request-changes')
  requestChanges(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
    @Body() dto: RequestChangesDto,
  ) {
    return this.admin.requestChanges(id, user.walletAddress, dto.message);
  }

  @Post('projects/:id/flag')
  proposeFlagCampaign(@Param('id') id: string, @Body() dto: FlagCampaignDto) {
    return this.admin.proposeFlagCampaign(id, dto.reason);
  }

  @Post('projects/:id/flag/confirm')
  confirmFlagCampaign(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.confirmFlagCampaignAudited(id, user.walletAddress);
  }

  @Get('projects/:id/flag/proposal')
  getFlagProposal(@Param('id') id: string) {
    return this.admin.getFlagProposalForCampaign(id);
  }

  @Post('projects/:id/unflag')
  unflagCampaign(@Param('id') id: string) {
    return this.admin.unflagCampaign(id);
  }

  @Post('projects/:id/propose-refund')
  proposeRefund(@Param('id') id: string, @Body() dto: ProposeRefundDto) {
    return this.admin.proposeRefund(id, dto.reason);
  }

  @Post('projects/:id/approve-refund')
  approveRefund(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.approveRefundAudited(id, user.walletAddress);
  }

  @Get('refund-proposals')
  getRefundProposals() {
    return this.admin.getRefundProposals();
  }

  @Get('flag-proposals')
  getFlagProposals() {
    return this.admin.getFlagProposals();
  }

  @Get('release-proposals')
  getReleaseFundsProposals() {
    return this.admin.getReleaseFundsProposals();
  }

  @Get('projects/:id/refund-proposal')
  getRefundProposalForCampaign(@Param('id') id: string) {
    return this.admin.getRefundProposalForCampaign(id);
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

  @Post('milestones/:id/release')
  proposeReleaseFunds(@Param('id') id: string) {
    return this.admin.proposeReleaseFunds(id);
  }

  @Post('milestones/:id/release/confirm')
  confirmReleaseFunds(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.confirmReleaseFundsAudited(id, user.walletAddress);
  }

  @Get('audit-log')
  getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getAuditLog(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 30,
    );
  }

  @Get('milestones/:id/release/proposal')
  getReleaseProposal(@Param('id') id: string) {
    return this.admin.getReleaseProposalForMilestone(id);
  }

  @Get('users')
  getUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getUsers(search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
  }

  @Post('governance/role-proposals')
  proposeRoleChange(
    @Body() dto: ProposeRoleChangeDto,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.proposeRoleChange(dto.targetUserId, dto.targetRole, user.walletAddress);
  }

  @Post('governance/role-proposals/:id/confirm')
  confirmRoleChange(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.confirmRoleChange(id, user.walletAddress);
  }

  @Delete('governance/role-proposals/:id')
  cancelRoleProposal(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.cancelRoleProposal(id, user.walletAddress);
  }

  @Get('governance/role-proposals')
  getRoleProposals(@Query('pending') pending?: string) {
    return this.admin.getRoleProposals(pending === 'true');
  }

  @Post('projects/:id/propose-approval')
  proposeApproval(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.proposeApproval(id, user.walletAddress);
  }

  @Post('projects/:id/confirm-approval')
  confirmApproval(
    @Param('id') id: string,
    @Body() body: { onChainId: number; milestoneOnChainIds: number[] },
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.confirmApproval(id, body.onChainId, body.milestoneOnChainIds ?? [], user.walletAddress);
  }

  @Get('projects/:id/approval-proposal')
  getApprovalProposal(@Param('id') id: string) {
    return this.admin.getApprovalProposal(id);
  }

  @Delete('projects/:id/approval-proposal')
  cancelApprovalProposal(
    @Param('id') id: string,
    @CurrentUser() user: { walletAddress: string },
  ) {
    return this.admin.cancelApprovalProposal(id, user.walletAddress);
  }

  @Get('governance/pending-approvals')
  getPendingApprovalProposals() {
    return this.admin.getPendingApprovalProposals();
  }
}
