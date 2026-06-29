import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get(':id/proof')
  getProof(@Param('id') id: string) {
    return this.milestones.getProof(id);
  }

  @Post(':id/proof')
  submitProof(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SubmitProofDto,
  ) {
    return this.milestones.submitProof(id, user.userId, dto);
  }
}
