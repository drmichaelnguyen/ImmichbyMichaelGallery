import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetResponseDto, mapAsset } from 'src/dtos/asset-response.dto';
import { AssetMediaOptionsDto, AssetMediaSize } from 'src/dtos/asset-media.dto';
import { AssetFileType, CacheControl } from 'src/enum';
import { BaseService } from 'src/services/base.service';
import { getFileNameWithoutExtension, getFilenameExtension, ImmichFileResponse } from 'src/utils/file';
import { mimeTypes } from 'src/utils/mime-types';

@Injectable()
export class FeaturedService extends BaseService {
  async getFeaturedAssets(): Promise<AssetResponseDto[]> {
    const assets = await this.assetRepository.getFeaturedAssets();
    return assets.map((asset) => mapAsset(asset));
  }

  async getFeaturedAsset(id: string): Promise<AssetResponseDto> {
    const asset = await this.assetRepository.getFeaturedById(id);
    if (!asset) {
      throw new NotFoundException('Featured asset not found');
    }
    return mapAsset(asset);
  }

  async viewFeaturedThumbnail(id: string, dto: AssetMediaOptionsDto): Promise<ImmichFileResponse> {
    if (!(await this.assetRepository.isFeaturedAsset(id))) {
      throw new NotFoundException('Featured asset not found');
    }

    if (dto.size === AssetMediaSize.Original) {
      throw new BadRequestException('May not request original file from featured thumbnail endpoint');
    }

    const mediaSize = dto.size ?? AssetMediaSize.PREVIEW;
    let fileType =
      mediaSize === AssetMediaSize.THUMBNAIL
        ? AssetFileType.Thumbnail
        : mediaSize === AssetMediaSize.FULLSIZE
          ? AssetFileType.FullSize
          : AssetFileType.Preview;

    let { originalPath, originalFileName, path } = await this.assetRepository.getForThumbnail(
      id,
      fileType,
      dto.edited ?? true,
    );

    if (fileType === AssetFileType.FullSize && !path) {
      fileType = AssetFileType.Preview;
      ({ originalPath, originalFileName, path } = await this.assetRepository.getForThumbnail(
        id,
        fileType,
        dto.edited ?? true,
      ));
    }

    if (!path) {
      if (mimeTypes.isWebSupportedImage(originalPath)) {
        return new ImmichFileResponse({
          path: originalPath,
          fileName: `${getFileNameWithoutExtension(originalFileName)}_${mediaSize}${getFilenameExtension(originalPath)}`,
          contentType: mimeTypes.lookup(originalPath),
          cacheControl: CacheControl.PrivateWithCache,
        });
      }
      throw new NotFoundException('Asset media not found');
    }

    return new ImmichFileResponse({
      path,
      fileName: `${getFileNameWithoutExtension(originalFileName)}_${mediaSize}${getFilenameExtension(path)}`,
      contentType: mimeTypes.lookup(path),
      cacheControl: CacheControl.PrivateWithCache,
    });
  }
}
