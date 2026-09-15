<script lang="ts">
  import type { SelectionBBox } from '$lib/components/shared-components/map/types';
  import { timeToLoadTheMap } from '$lib/constants';
  import { delay } from '$lib/utils/asset-utils';
  import type { MapMarkerResponseDto } from '@immich/sdk';
  import { LoadingSpinner, Modal, ModalBody } from '@immich/ui';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (bbox?: string) => void;
    mapMarkers: MapMarkerResponseDto[];
  };

  let { onClose, mapMarkers }: Props = $props();

  const handleClusterSelect = (_assetIds: string[], bbox: SelectionBBox) => {
    onClose(`${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  };
</script>

<Modal title={$t('shared_filter_map_area')} size="giant" {onClose}>
  <ModalBody>
    <p class="mb-3 text-sm text-gray-600 dark:text-gray-300">{$t('shared_filter_map_help')}</p>
    <div class="flex size-full flex-col gap-2 rounded-2xl border border-gray-300 dark:border-light">
      <div class="h-[70vh] min-h-[280px] w-full">
        {#await import('$lib/components/shared-components/map/Map.svelte')}
          {#await delay(timeToLoadTheMap) then}
            <div class="flex size-full items-center justify-center">
              <LoadingSpinner />
            </div>
          {/await}
        {:then { default: Map }}
          <Map
            clickable={false}
            {mapMarkers}
            onClusterSelect={handleClusterSelect}
            showSettings={false}
            rounded
            autoFitBounds
          />
        {/await}
      </div>
    </div>
  </ModalBody>
</Modal>
