import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SALT_ROUNDS } from 'src/constants';
import { AssetStatsDto, AssetStatsResponseDto, mapStats } from 'src/dtos/asset.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { CalendarHeatmapDto, CalendarHeatmapResponseDto } from 'src/dtos/calendar-heatmap.dto';
import { SessionResponseDto, mapSession } from 'src/dtos/session.dto';
import { UserPreferencesResponseDto, UserPreferencesUpdateDto, mapPreferences } from 'src/dtos/user-preferences.dto';
import {
  UserAdminCreateDto,
  UserAdminDeleteDto,
  UserAdminResponseDto,
  UserAdminSearchDto,
  UserAdminUpdateDto,
  mapUserAdmin,
} from 'src/dtos/user.dto';
import { JobName, UserMetadataKey, UserStatus } from 'src/enum';
import { UserFindOptions } from 'src/repositories/user.repository';
import { BaseService } from 'src/services/base.service';
import { getCalendarHeatmap } from 'src/services/shared/user-methods';
import { findOrFail } from 'src/utils/misc';
import { getPreferences, getPreferencesPartial, mergePreferences } from 'src/utils/preferences';

@Injectable()
export class UserAdminService extends BaseService {
  async search(auth: AuthDto, dto: UserAdminSearchDto): Promise<UserAdminResponseDto[]> {
    const users = await this.userRepository.getList({
      id: dto.id,
      withDeleted: dto.withDeleted,
    });
    return users.map((user) => mapUserAdmin(user));
  }

  async create(dto: UserAdminCreateDto): Promise<UserAdminResponseDto> {
    const { notify, privileges, ...userDto } = dto;
    const config = await this.getConfig({ withCache: false });
    if (!config.oauth.enabled && !userDto.password) {
      throw new BadRequestException('password is required');
    }

    const user = await this.createUser(userDto);

    if (privileges) {
      await this.userRepository.upsertMetadata(user.id, {
        key: UserMetadataKey.Privileges,
        value: privileges,
      });
    }

    await this.eventRepository.emit('UserSignup', {
      notify: !!notify,
      id: user.id,
      password: userDto.password,
    });

    if (privileges) {
      return mapUserAdmin(await this.findOrFail(user.id, {}));
    }

    return mapUserAdmin(user);
  }

  async get(auth: AuthDto, id: string): Promise<UserAdminResponseDto> {
    const user = await this.findOrFail(id, { withDeleted: true });
    return mapUserAdmin(user);
  }

  async update(auth: AuthDto, id: string, dto: UserAdminUpdateDto): Promise<UserAdminResponseDto> {
    const { privileges, ...userDto } = dto;
    const user = await this.findOrFail(id, {});

    if (dto.isAdmin !== undefined && dto.isAdmin !== auth.user.isAdmin && auth.user.id === id) {
      throw new BadRequestException('Admin status can only be changed by another admin');
    }

    if (dto.quotaSizeInBytes && user.quotaSizeInBytes !== dto.quotaSizeInBytes) {
      await this.userRepository.syncUsage(id);
    }

    if (dto.email) {
      const duplicate = await this.userRepository.getByEmail(dto.email);
      if (duplicate && duplicate.id !== id) {
        this.logger.debug('Email already in use by another account');
        throw new BadRequestException('Email is not available');
      }
    }

    if (dto.storageLabel) {
      const duplicate = await this.userRepository.getByStorageLabel(dto.storageLabel);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Storage label already in use by another account');
      }
    }

    if (userDto.password) {
      userDto.password = await this.cryptoRepository.hashBcrypt(userDto.password, SALT_ROUNDS);
    }

    if (userDto.pinCode) {
      userDto.pinCode = await this.cryptoRepository.hashBcrypt(userDto.pinCode, SALT_ROUNDS);
    }

    if (userDto.storageLabel === '') {
      userDto.storageLabel = null;
    }

    for (const [key, value] of Object.entries(userDto)) {
      if (value === undefined) {
        delete userDto[key as keyof typeof userDto];
      }
    }

    const updatedUser = await this.userRepository.update(id, { ...userDto, updatedAt: new Date() });

    if (privileges) {
      await this.userRepository.upsertMetadata(id, {
        key: UserMetadataKey.Privileges,
        value: privileges,
      });
      return mapUserAdmin(await this.findOrFail(id, {}));
    }

    return mapUserAdmin(updatedUser);
  }

  async delete(auth: AuthDto, id: string, dto: UserAdminDeleteDto): Promise<UserAdminResponseDto> {
    const { force } = dto;
    await this.findOrFail(id, {});
    if (auth.user.id === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.albumRepository.softDeleteAll(id);

    const status = force ? UserStatus.Removing : UserStatus.Deleted;
    const user = await this.userRepository.update(id, { status, deletedAt: new Date() });

    await this.eventRepository.emit('UserTrash', user);

    if (force) {
      await this.jobRepository.queue({ name: JobName.UserDelete, data: { id: user.id, force } });
    }

    return mapUserAdmin(user);
  }

  async restore(auth: AuthDto, id: string): Promise<UserAdminResponseDto> {
    await this.findOrFail(id, { withDeleted: true });
    await this.albumRepository.restoreAll(id);
    const user = await this.userRepository.restore(id);
    await this.eventRepository.emit('UserRestore', user);
    return mapUserAdmin(user);
  }

  async approve(auth: AuthDto, id: string): Promise<UserAdminResponseDto> {
    const user = await this.findOrFail(id, { withDeleted: false });
    if (user.status !== UserStatus.PendingApproval) {
      throw new BadRequestException('User is not pending approval');
    }

    const updatedUser = await this.userRepository.update(id, {
      status: UserStatus.Active,
      updatedAt: new Date(),
    });

    return mapUserAdmin(updatedUser);
  }

  async getCalendarHeatmap(auth: AuthDto, id: string, dto: CalendarHeatmapDto): Promise<CalendarHeatmapResponseDto> {
    await this.findOrFail(id, { withDeleted: false });
    return getCalendarHeatmap(id, dto, { asset: this.assetRepository });
  }

  async getSessions(auth: AuthDto, id: string): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionRepository.getByUserId(id);
    return sessions.map((session) => mapSession(session));
  }

  async getStatistics(auth: AuthDto, id: string, dto: AssetStatsDto): Promise<AssetStatsResponseDto> {
    const stats = await this.assetRepository.getStatistics(id, dto);
    return mapStats(stats);
  }

  async getPreferences(auth: AuthDto, id: string): Promise<UserPreferencesResponseDto> {
    await this.findOrFail(id, { withDeleted: true });
    const metadata = await this.userRepository.getMetadata(id);
    return mapPreferences(getPreferences(metadata));
  }

  async updatePreferences(auth: AuthDto, id: string, dto: UserPreferencesUpdateDto) {
    await this.findOrFail(id, { withDeleted: false });
    const metadata = await this.userRepository.getMetadata(id);
    const newPreferences = mergePreferences(getPreferences(metadata), dto);

    await this.userRepository.upsertMetadata(id, {
      key: UserMetadataKey.Preferences,
      value: getPreferencesPartial(newPreferences),
    });

    return mapPreferences(newPreferences);
  }

  private findOrFail(id: string, options: UserFindOptions) {
    return findOrFail(() => this.userRepository.get(id, options), 'User');
  }
}
