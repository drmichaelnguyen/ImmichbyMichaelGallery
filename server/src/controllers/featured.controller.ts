import { Controller, Get, Next, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { Endpoint, HistoryBuilder } from 'src/decorators';
import { AssetResponseDto } from 'src/dtos/asset-response.dto';
import { AssetMediaOptionsDto } from 'src/dtos/asset-media.dto';
import { UUIDParamDto } from 'src/validation';
import { ApiTag } from 'src/enum';
import { Authenticated, FileResponse } from 'src/middleware/auth.guard';
import { LoggingRepository } from 'src/repositories/logging.repository';
import { FeaturedService } from 'src/services/featured.service';
import { sendFile } from 'src/utils/file';

@ApiTags(ApiTag.Featured)
@Controller('featured')
export class FeaturedController {
  constructor(
    private service: FeaturedService,
    private logger: LoggingRepository,
  ) {
    this.logger.setContext(FeaturedController.name);
  }

  @Get('assets')
  @Authenticated({ public: true })
  @Endpoint({
    summary: 'List featured assets',
    description: 'Return assets marked as featured for the public gallery homepage. No login required.',
    history: new HistoryBuilder().added('v3.2.2'),
  })
  getFeaturedAssets(): Promise<AssetResponseDto[]> {
    return this.service.getFeaturedAssets();
  }

  @Get('assets/:id')
  @Authenticated({ public: true })
  @Endpoint({
    summary: 'Get a featured asset',
    description: 'Return a single featured asset. No login required.',
    history: new HistoryBuilder().added('v3.2.2'),
  })
  getFeaturedAsset(@Param() { id }: UUIDParamDto): Promise<AssetResponseDto> {
    return this.service.getFeaturedAsset(id);
  }

  @Get('assets/:id/thumbnail')
  @FileResponse()
  @Authenticated({ public: true })
  @Endpoint({
    summary: 'View featured asset thumbnail',
    description: 'Retrieve a thumbnail/preview for a featured asset. No login required.',
    history: new HistoryBuilder().added('v3.2.2'),
  })
  async viewFeaturedThumbnail(
    @Param() { id }: UUIDParamDto,
    @Query() dto: AssetMediaOptionsDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    await sendFile(res, next, () => this.service.viewFeaturedThumbnail(id, dto), this.logger);
  }
}
