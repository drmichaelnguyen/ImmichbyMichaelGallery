import { SvelteMap } from 'svelte/reactivity';

export interface DownloadState {
  url?: string;
  assetIds?: string[];
  archiveName?: string;
  total: number;
  progress?: number;
  percentage?: number;
  downloaded?: boolean;
  abort?: AbortController | null;
  unit?: 'bytes' | 'items';
}

class DownloadManager {
  assets = new SvelteMap<string, DownloadState>();

  isDownloading = $derived(this.assets.size > 0);

  add(
    key: string,
    urlOrTotal: string | number,
    assetIdsOrAbort?: string[] | AbortController,
    archiveNameOrUnit?: string | DownloadState['unit'],
    total?: number,
  ) {
    if (typeof urlOrTotal === 'string') {
      const url = urlOrTotal;
      const assetIds = assetIdsOrAbort as string[];
      const archiveName = archiveNameOrUnit as string;
      this.assets.set(key, {
        url,
        assetIds,
        archiveName,
        total: total ?? 0,
        downloaded: false,
        progress: 0,
        percentage: 0,
      });
      return;
    }

    const totalValue = urlOrTotal;
    const abort = assetIdsOrAbort as AbortController | undefined;
    const unit = (archiveNameOrUnit as DownloadState['unit']) ?? 'bytes';
    this.#update(key, { total: totalValue, progress: 0, percentage: 0, abort: abort ?? null, unit });
  }

  #update(key: string, value: Partial<DownloadState> | null) {
    if (value === null) {
      this.assets.delete(key);
      return;
    }

    const existing = this.assets.get(key);
    const item: DownloadState = existing ?? {
      total: 0,
      progress: 0,
      percentage: 0,
      abort: null,
    };

    Object.assign(item, value);
    item.percentage =
      item.total > 0 ? Math.min(Math.floor(((item.progress ?? 0) / item.total) * 100), 100) : 0;
    this.assets.set(key, item);
  }

  update(key: string, progress: number, total?: number) {
    const download: Partial<DownloadState> = { progress };
    if (total !== undefined) {
      download.total = total;
    }
    this.#update(key, download);
  }

  clear(key: string) {
    this.#update(key, null);
  }

  clearAll() {
    this.assets.clear();
  }

  markDownloaded(key: string) {
    const state = this.assets.get(key);
    if (state) {
      this.assets.set(key, { ...state, downloaded: true });
    }
  }
}

export const downloadManager = new DownloadManager();
