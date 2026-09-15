import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'node:path';
import sanitize from 'sanitize-filename';
import { StorageCore } from 'src/cores/storage.core';
import { AuthDto } from 'src/dtos/auth.dto';
import { DownloadArchiveDto, DownloadArchiveInfo, DownloadInfoDto, DownloadResponseDto } from 'src/dtos/download.dto';
import { AssetEditActionItem } from 'src/dtos/editing.dto';
import { AssetType, ExifOrientation, Permission } from 'src/enum';
import { ImmichReadStream, ImmichZipStream } from 'src/repositories/storage.repository';
import { BaseService } from 'src/services/base.service';
import { HumanReadableSize } from 'src/utils/bytes';
import { getPreferences } from 'src/utils/preferences';

@Injectable()
export class DownloadService extends BaseService {
  async getDownloadInfo(auth: AuthDto, dto: DownloadInfoDto): Promise<DownloadResponseDto> {
    let assets;

    if (dto.assetIds) {
      const assetIds = dto.assetIds;
      await this.requireAccess({ auth, permission: Permission.AssetDownload, ids: assetIds });
      assets = this.downloadRepository.downloadAssetIds(assetIds);
    } else if (dto.albumId) {
      const albumId = dto.albumId;
      await this.requireAccess({ auth, permission: Permission.AlbumDownload, ids: [albumId] });
      assets = this.downloadRepository.downloadAlbumId(albumId);
    } else if (dto.userId) {
      const userId = dto.userId;
      await this.requireAccess({ auth, permission: Permission.TimelineDownload, ids: [userId] });
      assets = this.downloadRepository.downloadUserId(userId);
    } else {
      throw new BadRequestException('assetIds, albumId, or userId is required');
    }

    const targetSize = dto.archiveSize || HumanReadableSize.GiB * 4;
    const metadata = await this.userRepository.getMetadata(auth.user.id);
    const preferences = getPreferences(metadata);
    const motionIds = new Set<string>();
    const archives: DownloadArchiveInfo[] = [];
    let archive: DownloadArchiveInfo = { size: 0, assetIds: [] };

    const addToArchive = ({ id, size }: { id: string; size: number | null }) => {
      archive.assetIds.push(id);
      archive.size += Number(size || 0);

      if (archive.size > targetSize) {
        archives.push(archive);
        archive = { size: 0, assetIds: [] };
      }
    };

    for await (const asset of assets) {
      // motion part of live photos
      if (asset.livePhotoVideoId) {
        motionIds.add(asset.livePhotoVideoId);
      }

      addToArchive(asset);
    }

    if (motionIds.size > 0) {
      const motionAssets = this.downloadRepository.downloadMotionAssetIds([...motionIds]);
      for await (const motionAsset of motionAssets) {
        if (StorageCore.isAndroidMotionPath(motionAsset.originalPath) && !preferences.download.includeEmbeddedVideos) {
          continue;
        }

        addToArchive(motionAsset);
      }
    }

    if (archive.assetIds.length > 0) {
      archives.push(archive);
    }

    let totalSize = 0;
    for (const archive of archives) {
      totalSize += archive.size;
    }

    return { totalSize, archives };
  }

  async downloadArchive(auth: AuthDto, dto: DownloadArchiveDto): Promise<ImmichReadStream> {
    await this.requireAccess({ auth, permission: Permission.AssetDownload, ids: dto.assetIds });

    const zip = this.storageRepository.createZipStream();
    if (dto.downloadFormat === 'jpg') {
      return this.downloadJpgArchive(dto, zip);
    }

    const assets = await this.assetRepository.getForOriginals(dto.assetIds, dto.edited ?? false);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const paths: Record<string, number> = {};

    for (const assetId of dto.assetIds) {
      const asset = assetMap.get(assetId);
      if (!asset) {
        continue;
      }

      const { originalPath, editedPath, originalFileName } = asset;

      let filename = sanitize(originalFileName) || 'unnamed';
      const count = paths[filename] || 0;
      paths[filename] = count + 1;
      if (count !== 0) {
        const parsedFilename = parse(filename);
        filename = `${parsedFilename.name}+${count}${parsedFilename.ext}`;
      }

      let realpath = dto.edited && editedPath ? editedPath : originalPath;

      try {
        realpath = await this.storageRepository.realpath(realpath);
      } catch {
        this.logger.warn('Unable to resolve realpath', { originalPath });
      }

      zip.addFile(realpath, filename);
    }

    void zip.finalize();

    return {
      stream: zip.stream,
      disposition: dto.archiveName && `attachment; filename*=UTF-8''${encodeURIComponent(dto.archiveName)}.zip`,
    };
  }

  private getArchiveFilename(paths: Record<string, number>, originalFileName: string, extension?: string) {
    const parsed = parse(sanitize(originalFileName) || 'unnamed');
    let filename = extension ? `${parsed.name || 'unnamed'}${extension}` : sanitize(originalFileName) || 'unnamed';
    const count = paths[filename] || 0;
    paths[filename] = count + 1;
    if (count !== 0) {
      const parsedFilename = parse(filename);
      filename = `${parsedFilename.name}+${count}${parsedFilename.ext}`;
    }
    return filename;
  }

  private async downloadJpgArchive(dto: DownloadArchiveDto, zip: ImmichZipStream) {
    const { image } = await this.getConfig({ withCache: true });
    const wantEdited = dto.edited ?? true;
    const editedPaths = wantEdited
      ? new Map(
          (await this.assetRepository.getForOriginals(dto.assetIds, true)).map((asset) => [
            asset.id,
            asset.editedPath ?? null,
          ]),
        )
      : new Map<string, string | null>();

    const assetEntries = await Promise.all(
      dto.assetIds.map(async (assetId) => {
        try {
          return [assetId, await this.assetRepository.getForEdit(assetId)] as const;
        } catch {
          return [assetId, null] as const;
        }
      }),
    );
    const assetMap = new Map(assetEntries.filter((entry) => !!entry[1]));
    const paths: Record<string, number> = {};

    for (const assetId of dto.assetIds) {
      const asset = assetMap.get(assetId);
      if (!asset?.originalPath) {
        continue;
      }

      if (asset.type === AssetType.Image) {
        const filename = this.getArchiveFilename(paths, asset.originalFileName, '.jpg');
        const editedPath = editedPaths.get(assetId);

        // Prefer the already-rendered edited fullsize JPEG when available.
        if (wantEdited && editedPath) {
          try {
            let realpath = editedPath;
            try {
              realpath = await this.storageRepository.realpath(editedPath);
            } catch {
              // use editedPath as-is
            }
            zip.addFile(realpath, filename);
            continue;
          } catch (error) {
            this.logger.warn('Unable to add edited JPG to archive; rendering from edits', {
              assetId,
              editedPath,
              error,
            });
          }
        }

        try {
          const persistedEdits = wantEdited ? await this.assetEditRepository.getAll(assetId) : [];
          const edits = persistedEdits.map(({ action, parameters }) => ({
            action,
            parameters,
          })) as AssetEditActionItem[];
          const buffer = await this.mediaRepository.renderImageBufferWithEdits(asset.originalPath, {
            colorspace: image.colorspace,
            processInvalidImages: process.env.IMMICH_PROCESS_INVALID_IMAGES === 'true',
            orientation: (asset.orientation as ExifOrientation | null) ?? undefined,
            edits,
          });
          zip.addBuffer(buffer, filename);
          continue;
        } catch (error) {
          this.logger.warn('Unable to render JPG for archive; falling back to original', {
            assetId,
            originalPath: asset.originalPath,
            error,
          });
        }
      }

      const filename = this.getArchiveFilename(paths, asset.originalFileName);
      let realpath = asset.originalPath;
      try {
        realpath = await this.storageRepository.realpath(realpath);
      } catch {
        this.logger.warn('Unable to resolve realpath', { originalPath: asset.originalPath });
      }
      zip.addFile(realpath, filename);
    }

    void zip.finalize();
    return { stream: zip.stream };
  }
}
