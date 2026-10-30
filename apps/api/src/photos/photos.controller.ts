import {
  photoConfirmSchema,
  photoOrderSchema,
  photoUploadRequestSchema,
  type Photo,
  type PhotoConfirm,
  type PhotoOrder,
  type PhotoUploadRequest,
  type PhotoUploadResponse,
} from '@arenaz/contracts';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PhotosService } from './photos.service.js';

// Bodies are validated by the pipes before a handler runs, so an invalid body
// gets the same 422 whoever owns the venue (no existence leak).
@Controller('owner/venues/:id/photos')
@UseGuards(AuthGuard)
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('upload-url')
  uploadUrl(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(photoUploadRequestSchema)) input: PhotoUploadRequest,
  ): Promise<PhotoUploadResponse> {
    return this.photos.createUploadUrl(user.id, id, input);
  }

  @Post()
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(photoConfirmSchema)) input: PhotoConfirm,
  ): Promise<Photo> {
    return this.photos.confirm(user.id, id, input);
  }

  @Put('order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(photoOrderSchema)) input: PhotoOrder,
  ): Promise<Photo[]> {
    return this.photos.reorder(user.id, id, input);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.photos.remove(user.id, id, photoId);
  }
}
