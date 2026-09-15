<script lang="ts">
  import Combobox, { asComboboxOptions, asSelectedOption } from '$lib/components/shared-components/Combobox.svelte';
  import type { SharedLinkFilter } from '$lib/types';
  import type { SharedLinkLocationOptions } from '$lib/utils/shared-link-filters';
  import { hasActiveSharedLinkFilter, citiesForCountry } from '$lib/utils/shared-link-filters';
  import type { MapMarkerResponseDto, AssetResponseDto } from '@immich/sdk';
  import { Button, DatePicker, Icon, Text, modalManager } from '@immich/ui';
  import { mdiClose, mdiFilterOutline, mdiMapMarkerRadius } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import SharedLinkMapFilterModal from '$lib/modals/SharedLinkMapFilterModal.svelte';

  interface Props {
    filters?: SharedLinkFilter;
    showLocation?: boolean;
    locationOptions?: SharedLinkLocationOptions;
    mapMarkers?: MapMarkerResponseDto[];
    sourceAssets?: AssetResponseDto[];
  }

  let {
    filters = $bindable({}),
    showLocation = false,
    locationOptions = { countries: [], cities: [] },
    mapMarkers = [],
    sourceAssets = [],
  }: Props = $props();

  let expanded = $state(false);

  const filteredCities = $derived(citiesForCountry(sourceAssets, filters.country, mapMarkers));

  const clearFilters = () => {
    filters = {};
  };

  const openMapFilter = async () => {
    if (mapMarkers.length === 0) {
      return;
    }

    const bbox = await modalManager.show(SharedLinkMapFilterModal, { mapMarkers });
    if (bbox) {
      filters = { ...filters, bbox };
    }
  };
</script>

<section class="mb-6 rounded-2xl border border-gray-200 bg-white/80 p-3 dark:border-immich-dark-gray dark:bg-immich-dark-gray/40">
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 text-start"
    onclick={() => (expanded = !expanded)}
  >
    <span class="inline-flex items-center gap-2 text-sm font-medium text-primary">
      <Icon icon={mdiFilterOutline} size="18" />
      {$t('shared_filters')}
    </span>
    {#if hasActiveSharedLinkFilter(filters)}
      <span class="rounded-full bg-immich-primary/15 px-2 py-0.5 text-xs text-immich-primary">{$t('active')}</span>
    {/if}
  </button>

  {#if expanded}
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <Text class="mb-2" fontWeight="medium">{$t('start_date')}</Text>
        <DatePicker bind:value={filters.takenAfter} />
      </div>
      <div>
        <Text class="mb-2" fontWeight="medium">{$t('end_date')}</Text>
        <DatePicker bind:value={filters.takenBefore} />
      </div>

      {#if showLocation}
        <div>
          <Combobox
            label={$t('country')}
            onSelect={(option) => {
              filters = { ...filters, country: option?.value, city: undefined };
            }}
            options={asComboboxOptions(locationOptions.countries)}
            placeholder={$t('search_country')}
            selectedOption={asSelectedOption(filters.country)}
          />
        </div>
        <div>
          <Combobox
            label={$t('city')}
            onSelect={(option) => {
              filters = { ...filters, city: option?.value };
            }}
            options={asComboboxOptions(filteredCities)}
            placeholder={$t('search_city')}
            selectedOption={asSelectedOption(filters.city)}
          />
        </div>
        {#if mapMarkers.length > 0}
          <div class="md:col-span-2">
            <Button shape="round" variant="outline" color="secondary" onclick={openMapFilter}>
              <Icon icon={mdiMapMarkerRadius} size="18" />
              {$t('shared_filter_map_area')}
            </Button>
            {#if filters.bbox}
              <Text class="mt-2 text-xs text-gray-500">{$t('shared_filter_map_active')}</Text>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    {#if filters.takenAfter && filters.takenBefore && filters.takenAfter > filters.takenBefore}
      <Text class="mt-2" color="danger">{$t('start_date_before_end_date')}</Text>
    {/if}

    {#if hasActiveSharedLinkFilter(filters)}
      <div class="mt-4">
        <Button shape="round" variant="ghost" color="secondary" onclick={clearFilters}>
          <Icon icon={mdiClose} size="18" />
          {$t('clear_filters')}
        </Button>
      </div>
    {/if}
  {/if}
</section>
