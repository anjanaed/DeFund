import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.getForUser(user.userId, {
      limit: limit ? parseInt(limit, 10) : 20,
      cursor,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { userId: string }) {
    const count = await this.notificationsService.getUnreadCount(user.userId);
    return { count };
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: { userId: string }) {
    await this.notificationsService.markAllRead(user.userId);
    return { success: true };
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.notificationsService.markRead(id, user.userId);
  }
}
