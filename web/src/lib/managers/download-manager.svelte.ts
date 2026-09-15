export interface DownloadProgress {
  progress: number;
  total: number;
  percentage: number;
  abort: AbortController | null;
  unit?: 'bytes' | 'items';
}

class DownloadManager {
  assets = $state<Record<string, DownloadProgress>>({});

  isDownloading = $derived(Object.keys(this.assets).length > 0);

  #update(key: string, value: Partial<DownloadProgress> | null) {
    if (value === null) {
      delete this.assets[key];
      return;
    }

    if (!this.assets[key]) {
      this.assets[key] = { progress: 0, total: 0, percentage: 0, abort: null };
    }

    const item = this.assets[key];
    Object.assign(item, value);
    item.percentage = item.total > 0 ? Math.min(Math.floor((item.progress / item.total) * 100), 100) : 0;
  }

  add(key: string, total: number, abort?: AbortController, unit: DownloadProgress['unit'] = 'bytes') {
    this.#update(key, { total, abort, unit });
  }

  clear(key: string) {
    this.#update(key, null);
  }

  update(key: string, progress: number, total?: number) {
    const download: Partial<DownloadProgress> = { progress };
    if (total !== undefined) {
      download.total = total;
    }
    this.#update(key, download);
  }
}

export const downloadManager = new DownloadManager();
