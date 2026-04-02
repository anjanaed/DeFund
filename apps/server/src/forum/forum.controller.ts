import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects/:id/forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get()
  getForum(@Param('id') id: string) {
    return this.forum.getForumByProjectId(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  postMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateMessageDto,
  ) {
    return this.forum.createMessage(id, user.userId, dto);
  }
}
