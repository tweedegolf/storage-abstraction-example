import to from "await-to-js";
import {
  BodyParams,
  Controller,
  Delete,
  Get,
  PathParams,
  Post,
  Req,
  Res,
  Required,
} from "@tsed/common";
import { MultipartFile } from "@tsed/multipartfiles";
import { Returns, ReturnsArray, Summary, Description } from "@tsed/swagger";
import { NotFound, UnsupportedMediaType, InternalServerError } from "ts-httpexceptions";
import { Request, Response } from "express";
import mime from "mime";
import { pipeline, Readable } from "stream";

import { MediaFileService } from "../services/MediaFileService";
import { MediaFile } from "../entities/MediaFile";
import { MediaFileRepository } from "../services/repositories/MediaFileRepository";
import { ThumbnailService } from "../services/ThumbnailService";

export const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/svg",
  "application/svg",
  "application/svg+xml",
  "application/pdf",
  "application/x-pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

@Controller("/media")
export class MediaFileController {
  public constructor(
    private readonly mediaFileService: MediaFileService,
    private readonly mediaFileRepository: MediaFileRepository,
    private readonly thumbnailerService: ThumbnailService
  ) {}

  private async getMediaFile(id: number, filePath?: string): Promise<MediaFile> {
    const mediaFile = await this.mediaFileRepository.findOne(id);

    if (!mediaFile) {
      throw new NotFound("File not found in repository");
    }

    if (typeof filePath !== "undefined" && mediaFile.path !== filePath) {
      throw new NotFound(
        "File not found: supplied file path doesn't match with file path in repository"
      );
    }

    return mediaFile;
  }

  private async download(res: Response, id: number, filePath?: string): Promise<void> {
    const mediaFile = await this.getMediaFile(id, filePath);
    const stream = await this.mediaFileService.getFileReadStream(mediaFile.path);

    res.set("Content-Type", mime.getType(mediaFile.path));
    res.set("Content-Disposition", "inline");

    await new Promise(resolve => {
      return pipeline(stream, res, err => {
        if (err) {
          throw new InternalServerError(err.message);
        } else {
          resolve();
        }
      });
    });
  }

  private async getThumb(
    res: Response,
    id: number,
    format: "pjpeg" | "png",
    width: number,
    filePath?: string
  ) {
    const mediaFile = await this.getMediaFile(id, filePath);

    const { success, stream, contentType } = await this.thumbnailerService.getThumbnailReadStream(
      mediaFile.path,
      {
        format,
        width,
      }
    );

    if (!success) {
      throw new NotFound("File not found");
    }

    res.set("Content-Type", contentType);
    res.set("Content-Disposition", "inline");

    await new Promise(resolve => {
      return pipeline(stream, res, err => {
        if (err) {
          throw new InternalServerError(err.message);
        } else {
          resolve();
        }
      });
    });
  }

  @Post("/")
  @ReturnsArray(200, { type: MediaFile })
  @Returns(415, { description: "Unsupported file type" })
  @Returns(500, { description: "Internal server error" })
  @Description(
    "Upload one or more images to the server and add them to the selected storage, a thumbnail of the image will be created and its metadata will be stored in the database"
  )
  // @Summary('Upload one or more images to the server and add them to the selected storage, a thumbnail of the image will be created and its metadata will be stored in the database')
  public async uploadFile(
    @Required @MultipartFile("files", 10) tmpFiles: Express.Multer.File[],
    @BodyParams("location") location: string
  ): Promise<MediaFile[]> {
    if (!tmpFiles) {
      throw new UnsupportedMediaType("Unsupported file type");
    }

    const promises = [];
    for (let i = 0; i < tmpFiles.length; i += 1) {
      promises.push(this.mediaFileService.moveUploadedFile(tmpFiles[i], location));
    }

    const result = await Promise.all(promises);
    return this.mediaFileRepository.create(result);
  }

  @Get("/download/:id")
  @Returns(200, { description: "File contents" })
  @Returns(404, { description: "File not found" })
  @Returns(500, { description: "Internal server error" })
  public async getMediaDownload(
    @Res() res: Response,
    @Required @PathParams("id") id: number
  ): Promise<void> {
    return this.download(res, id);
  }

  @Get("/download/:id/*")
  @Returns(200, { description: "File contents" })
  @Returns(404, { description: "File not found" })
  @Returns(500, { description: "Internal server error" })
  public async getMediaDownloadWithCheckPath(
    @Req() req: Request,
    @Res() res: Response,
    @PathParams("id") id: number
  ): Promise<void> {
    const filePath = req.params[0];
    return this.download(res, id, filePath);
  }

  @Get("/list/:bucket")
  @ReturnsArray(200, { type: MediaFile })
  @Returns(500, { description: "Internal server error" })
  public async listFiles2(@PathParams("bucket") bucket: string): Promise<MediaFile[]> {
    await this.mediaFileService.selectBucket(bucket);
    await this.mediaFileRepository.synchronize();
    const files = await this.mediaFileRepository.find();
    return files;
  }

  @Get("/list")
  @ReturnsArray(200, { type: MediaFile })
  @Returns(500, { description: "Internal server error" })
  public async listFiles(): Promise<MediaFile[]> {
    return await this.mediaFileRepository.find();
  }

  @Delete("/:id")
  @Returns(200, { type: Number })
  @Returns(404, { description: "File not found" })
  @Returns(500, { description: "Internal server error" })
  public async deleteFileById(@Required @PathParams("id") id: number): Promise<{ id: number }> {
    const file = await this.mediaFileRepository.findOne(id);
    if (!file) {
      throw new NotFound("File not found");
    }
    await this.mediaFileService.unlinkMediaFile(file.path);
    await this.mediaFileRepository.remove([file]);
    return { id };
  }
  /*
    @Post('/delete')
    @Returns(200, { type: Boolean })
    @Returns(500, { description: 'Internal server error' })
    public async deleteFileByPath(
      @Required @BodyParams('filePath') filePath: string,
    ): Promise<boolean> {
      await to(this.mediaFileService.unlinkMediaFile(filePath));
      await this.mediaFileRepository.deleteWhere({ path: filePath });
      return true;
    }
  */
  @Get("/thumbnail/:format/:width/:id")
  @Returns(404, { description: "File not found" })
  @Returns(500, { description: "Internal server error" })
  public async getMediaThumbnail(
    @PathParams("format") format: "png" | "pjpeg",
    @PathParams("width") width: string,
    @PathParams("id") id: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    return this.getThumb(res, parseInt(id, 10), format, parseInt(width, 10));
  }

  @Get("/thumbnail/:format/:width/:id/*")
  @Returns(404, { description: "File not found" })
  @Returns(500, { description: "Internal server error" })
  public async getMediaThumbnailWithCheckPath(
    @PathParams("format") format: "png" | "pjpeg",
    @PathParams("width") width: string,
    @PathParams("id") id: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const filePath = req.params[0];
    return this.getThumb(res, parseInt(id, 10), format, parseInt(width, 10), filePath);
  }
}
