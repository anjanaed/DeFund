import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('home')
  getHomeStats() {
    return this.stats.getHomeStats();
  }
}
