import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { PostsService } from '@modules/posts.service';
import { CreatePostDto } from '@dto/create-post.dto';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Post as PostModel } from '@models/post.model';
import { JwtGuard } from '@guards/jwt.guard';
import { UserDecorator } from '@decorators/user.decorator';
import { UpdatePostDto } from '@dto/update-post.dto';
import { LeaveCommentDto } from '@dto/leave-comment.dto';
import { DeletePostEvent } from '@events/delete-post.event';
import { DeletePostEventDto } from '@event-dto/delete-post.event.dto';
import { LeaveCommentEvent } from '@events/leave-comment.event';
import { LeaveCommentEventDto } from '@event-dto/leave-comment.event.dto';
import { LogEvent } from '@events/log.event';
import { LogEventDto } from '@event-dto/log.event.dto';
import { UpdatePostEventDto } from '@event-dto/update-post.event.dto';
import { PostInfo } from '@models/post-info.model';
import { CreatePostEvent } from '@events/create-post.event';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @ApiExtraModels(PostModel)
  @ApiExtraModels(PostInfo)
  @ApiExtraModels(CreatePostEvent)
  @ApiOperation({ summary: 'Responsible for post creation' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns success message'
  })
  @UseGuards(JwtGuard)
  @Post('create')
  createPost(@UserDecorator() userId: string, @Body() payload: CreatePostDto) {
    return this.postsService.createPost({ ...payload, userId });
  }

  @ApiOperation({ summary: 'Gets post by its id' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns post'
  })
  @Get('get/:id')
  getPostById(@Param('id') id: string) {
    return this.postsService.getPostById({ id });
  }

  @ApiOperation({ summary: 'List posts' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns list of posts'
  })
  @Get('list/:page/:pageSize/:order/:orderBy')
  async getAllPosts(
    @Param('page') page: number,
    @Param('pageSize') pageSize: number,
    @Param('order') order: string,
    @Param('orderBy') orderBy: string,
    @Query('searchQuery') searchQuery: string,
    @Query('userId') userId: string
  ) {
    return this.postsService.listPosts({
      page,
      pageSize,
      order,
      orderBy,
      searchQuery
    });
  }

  @ApiExtraModels(DeletePostEvent)
  @ApiExtraModels(DeletePostEventDto)
  @ApiOperation({ summary: 'Responsible for post deletion' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns success message'
  })
  @UseGuards(JwtGuard)
  @Delete('delete/:id')
  deletePost(@Param('id') id: string) {
    return this.postsService.deletePost({ id });
  }

  @ApiExtraModels(UpdatePostDto)
  @ApiExtraModels(UpdatePostEventDto)
  @ApiOperation({ summary: 'Responsible for post update' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns success message'
  })
  @UseGuards(JwtGuard)
  @Patch('update/:id')
  updatePost(@Param('id') postId: string, @Body() payload: UpdatePostDto) {
    return this.postsService.updatePost({ postId, ...payload });
  }

  @ApiExtraModels(LogEvent)
  @ApiExtraModels(LogEventDto)
  @ApiExtraModels(LeaveCommentEvent)
  @ApiExtraModels(LeaveCommentEventDto)
  @ApiOperation({ summary: 'Allows users to leave comments' })
  @ApiResponse({
    status: 201,
    description: 'As a response function returns success message'
  })
  @UseGuards(JwtGuard)
  @Patch('comment/:id')
  leaveComment(
    @Param('id') postId: string,
    @UserDecorator() userId: string,
    @Body() payload: LeaveCommentDto
  ) {
    return this.postsService.leaveComment({ ...payload, userId, postId });
  }
}
