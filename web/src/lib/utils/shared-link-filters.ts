import type { SharedLinkFilter } from '$lib/types';
import { parseUtcDate } from '$lib/utils/date-time';
import type { AssetResponseDto, MapMarkerResponseDto } from '@immich/sdk';
import { DateTime } from 'luxon';
import { ceil, floor } from 'lodash-es';
import type { SelectionBBox } from '$lib/components/shared-components/map/types';

export type SharedLinkLocationOptions = {
  countries: string[];
  cities: string[];
};

export const emptySharedLinkFilter = (): SharedLinkFilter => ({});

export const hasActiveSharedLinkFilter = (filters: SharedLinkFilter): boolean =>
  !!(filters.takenAfter || filters.takenBefore || filters.country || filters.city || filters.bbox);

export const locationOptionsFromMapMarkers = (markers: MapMarkerResponseDto[]): SharedLinkLocationOptions => {
  const countries = new Set<string>();
  const cities = new Set<string>();

  for (const marker of markers) {
    if (marker.country) {
      countries.add(marker.country);
    }
    if (marker.city) {
      cities.add(marker.city);
    }
  }

  return {
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
  };
};

export const locationOptionsFromAssets = (assets: AssetResponseDto[]): SharedLinkLocationOptions => {
  const countries = new Set<string>();
  const cities = new Set<string>();

  for (const asset of assets) {
    const exif = asset.exifInfo;
    if (!exif) {
      continue;
    }
    if (exif.country) {
      countries.add(exif.country);
    }
    if (exif.city) {
      cities.add(exif.city);
    }
  }

  return {
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
  };
};

export const citiesForCountry = (
  assets: AssetResponseDto[],
  country: string | undefined,
  markers: MapMarkerResponseDto[],
): string[] => {
  const cities = new Set<string>();

  if (markers.length > 0) {
    for (const marker of markers) {
      if (marker.city && (!country || marker.country === country)) {
        cities.add(marker.city);
      }
    }
    return [...cities].sort((a, b) => a.localeCompare(b));
  }

  for (const asset of assets) {
    const exif = asset.exifInfo;
    if (!exif?.city) {
      continue;
    }
    if (!country || exif.country === country) {
      cities.add(exif.city);
    }
  }

  return [...cities].sort((a, b) => a.localeCompare(b));
};

export const toTimelineFilterOptions = (filters: SharedLinkFilter) => ({
  takenAfter: filters.takenAfter?.toISODate() ?? undefined,
  takenBefore: filters.takenBefore?.toISODate() ?? undefined,
  country: filters.country || undefined,
  city: filters.city || undefined,
  bbox: filters.bbox || undefined,
});

export const bboxToTimelineString = (bbox: SelectionBBox) =>
  `${floor(bbox.west, 6)},${floor(bbox.south, 6)},${ceil(bbox.east, 6)},${ceil(bbox.north, 6)}`;

const parseAssetDate = (value: string) => parseUtcDate(value);

const isWithinBbox = (lat: number, lon: number, bbox: string) => {
  const [west, south, east, north] = bbox.split(',').map(Number);
  if ([west, south, east, north].some((part) => Number.isNaN(part))) {
    return true;
  }

  if (lat < south || lat > north) {
    return false;
  }

  if (west <= east) {
    return lon >= west && lon <= east;
  }

  return lon >= west || lon <= east;
};

export const filterSharedAssets = (assets: AssetResponseDto[], filters: SharedLinkFilter): AssetResponseDto[] => {
  if (!hasActiveSharedLinkFilter(filters)) {
    return assets;
  }

  return assets.filter((asset) => {
    const takenAt = parseAssetDate(asset.localDateTime);

    if (filters.takenAfter && takenAt < filters.takenAfter.startOf('day')) {
      return false;
    }

    if (filters.takenBefore && takenAt > filters.takenBefore.endOf('day')) {
      return false;
    }

    const exif = asset.exifInfo;
    if (filters.country && exif?.country !== filters.country) {
      return false;
    }

    if (filters.city && exif?.city !== filters.city) {
      return false;
    }

    if (filters.bbox && exif?.latitude != null && exif?.longitude != null) {
      return isWithinBbox(exif.latitude, exif.longitude, filters.bbox);
    }

    if (filters.bbox && (exif?.latitude == null || exif?.longitude == null)) {
      return false;
    }

    return true;
  });
};

export const filterLabel = (filters: SharedLinkFilter, formatDate: (date: DateTime) => string): string[] => {
  const labels: string[] = [];

  if (filters.takenAfter) {
    labels.push(formatDate(filters.takenAfter));
  }
  if (filters.takenBefore) {
    labels.push(formatDate(filters.takenBefore));
  }
  if (filters.country) {
    labels.push(filters.country);
  }
  if (filters.city) {
    labels.push(filters.city);
  }
  if (filters.bbox) {
    labels.push('map');
  }

  return labels;
};
