import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IpfsService } from './ipfs.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// Minimal shape of a multer file — avoids depending on @types/multer.
interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('uploads')
export class IpfsController {
  constructor(private readonly ipfs: IpfsService) {}

  /**
   * Pin a single file to IPFS and return its CID plus a ready-to-use gateway URL.
   * Auth-guarded so only signed-in users can upload.
   */
  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  async uploadFile(@UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('No file provided.');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB limit.');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const cid = await this.ipfs.pinFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    return {
      cid,
      url: this.ipfs.gatewayUrl(cid),
      name: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Pin an arbitrary JSON document (e.g. a milestone proof manifest) and return
   * its CID. Used when a proof bundles several files plus a note into one record.
   */
  @Post('json')
  async uploadJson(@Body() body: { content?: unknown; name?: string }) {
    if (!body || body.content === undefined || body.content === null) {
      throw new BadRequestException('No JSON content provided.');
    }
    const cid = await this.ipfs.pinJSON(body.content, body.name || 'defund-json');
    return { cid, url: this.ipfs.gatewayUrl(cid) };
  }
}
