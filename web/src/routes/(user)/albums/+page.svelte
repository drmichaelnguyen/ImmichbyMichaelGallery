<script lang="ts">
  import { scrollMemory } from '$lib/actions/scroll-memory';
  import AlbumsControls from './AlbumsControls.svelte';
  import Albums from '$lib/components/album-page/AlbumsList.svelte';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import GroupTab from '$lib/elements/GroupTab.svelte';
  import SearchBar from '$lib/elements/SearchBar.svelte';
  import { Route } from '$lib/route';
  import { AlbumFilter, albumViewSettings } from '$lib/stores/preferences.store';
  import { createAlbumAndRedirect } from '$lib/utils/album-utils';
  import CreateSharedAlbumModal from '$lib/modals/CreateSharedAlbumModal.svelte';
  import { goto } from '$app/navigation';
  import type { AlbumResponseDto } from '@immich/sdk';
  import { Button, modalManager, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let searchQuery = $state('');
  let albumGroups: string[] = $state([]);
  let selecting = $state(false);
  let selectedAlbumIds = $state<string[]>([]);

  const toggleAlbum = (album: AlbumResponseDto) => {
    selectedAlbumIds = selectedAlbumIds.includes(album.id)
      ? selectedAlbumIds.filter((id) => id !== album.id)
      : [...selectedAlbumIds, album.id];
  };

  const createSharedAlbum = async () => {
    const created = await modalManager.show(CreateSharedAlbumModal, { albumIds: selectedAlbumIds });
    if (!created) {
      return;
    }

    selecting = false;
    selectedAlbumIds = [];
    await goto(Route.viewAlbum(created.album));
  };
</script>

<UserPageLayout title={data.meta.title} use={[[scrollMemory, { routeStartsWith: Route.albums() }]]}>
  {#snippet buttons()}
    <div class="flex place-items-center gap-2">
      <AlbumsControls {albumGroups} bind:searchQuery />
      <Button
        size="small"
        variant="ghost"
        color="secondary"
        onclick={() => {
          selecting = !selecting;
          if (!selecting) {
            selectedAlbumIds = [];
          }
        }}
      >
        {selecting ? $t('done_selecting') : $t('select_to_share')}
      </Button>
    </div>
  {/snippet}

  <div class="xl:hidden">
    <div class="h-14 w-fit py-2 dark:text-immich-dark-fg">
      <GroupTab
        label={$t('show_albums')}
        filters={Object.keys(AlbumFilter)}
        selected={$albumViewSettings.filter}
        onSelect={(selected) => ($albumViewSettings.filter = selected)}
      />
    </div>
    <div class="w-60">
      <SearchBar placeholder={$t('search_albums')} bind:name={searchQuery} showLoadingSpinner={false} />
    </div>
  </div>

  {#if selecting}
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <Text>{$t('selected')} ({selectedAlbumIds.length})</Text>
      <Button size="small" disabled={selectedAlbumIds.length < 2} onclick={createSharedAlbum}>
        {$t('create_shared_album')}
      </Button>
      {#if selectedAlbumIds.length < 2}
        <Text size="small" color="muted">{$t('select_at_least_two')}</Text>
      {/if}
    </div>
  {/if}

  <Albums
    ownedAlbums={data.albums}
    sharedAlbums={data.sharedAlbums}
    userSettings={$albumViewSettings}
    allowEdit
    {searchQuery}
    bind:albumGroupIds={albumGroups}
    {selectedAlbumIds}
    onToggleAlbum={selecting ? toggleAlbum : undefined}
  >
    {#snippet empty()}
      <EmptyPlaceholder text={$t('no_albums_message')} onClick={() => createAlbumAndRedirect()} class="mx-auto mt-10" />
    {/snippet}
  </Albums>
</UserPageLayout>
