import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ReactionDto } from './dto/reaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects/:id/forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get()
  getForum(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.forum.getForumByProjectId(
      id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
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

  @Patch(':messageId')
  @UseGuards(JwtAuthGuard)
  updateMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.forum.updateMessage(id, messageId, user, dto);
  }

  @Delete(':messageId')
  @UseGuards(JwtAuthGuard)
  deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: any,
  ) {
    return this.forum.deleteMessage(id, messageId, user);
  }

  @Post(':messageId/reactions')
  @UseGuards(JwtAuthGuard)
  toggleReaction(
    @Param('messageId') messageId: string,
    @CurrentUser() user: any,
    @Body() dto: ReactionDto,
  ) {
    return this.forum.toggleReaction(messageId, user.userId, dto.type);
  }
}
