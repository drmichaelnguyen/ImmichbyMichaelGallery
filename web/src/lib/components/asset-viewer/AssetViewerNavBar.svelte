<script lang="ts">
  import ActionMenuItem from '$lib/components/ActionMenuItem.svelte';
  import type { OnAction, PreAction } from '$lib/components/asset-viewer/actions/action';
  import AddToStackAction from '$lib/components/asset-viewer/actions/AddToStackAction.svelte';
  import ArchiveAction from '$lib/components/asset-viewer/actions/ArchiveAction.svelte';
  import DeleteAction from '$lib/components/asset-viewer/actions/DeleteAction.svelte';
  import KeepThisDeleteOthersAction from '$lib/components/asset-viewer/actions/KeepThisDeleteOthers.svelte';
  import RatingAction from '$lib/components/asset-viewer/actions/RatingAction.svelte';
  import RemoveAssetFromStack from '$lib/components/asset-viewer/actions/RemoveAssetFromStack.svelte';
  import RestoreAction from '$lib/components/asset-viewer/actions/RestoreAction.svelte';
  import SetFeaturedPhotoAction from '$lib/components/asset-viewer/actions/SetPersonFeaturedAction.svelte';
  import SetStackPrimaryAsset from '$lib/components/asset-viewer/actions/SetStackPrimaryAsset.svelte';
  import SetVisibilityAction from '$lib/components/asset-viewer/actions/SetVisibilityAction.svelte';
  import UnstackAction from '$lib/components/asset-viewer/actions/UnstackAction.svelte';
  import LoadingDots from '$lib/components/LoadingDots.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/ButtonContextMenu.svelte';
  import RemoveFromAlbumAction from '$lib/components/timeline/actions/RemoveFromAlbumAction.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { languageManager } from '$lib/managers/language-manager.svelte';
  import { getAlbumAssetActions } from '$lib/services/album.service';
  import { getGlobalActions } from '$lib/services/app.service';
  import { getAssetActions } from '$lib/services/asset.service';
  import { preferUnenhancedSharedThumbnails } from '$lib/stores/preferences.store';
  import { getSharedLink, isEnabled, withoutIcons } from '$lib/utils';
  import type { OnUndoDelete } from '$lib/utils/actions';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import {
    AssetTypeEnum,
    AssetVisibility,
    type AlbumResponseDto,
    type AssetResponseDto,
    type PersonResponseDto,
    type StackResponseDto,
  } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider, Icon, Tooltip, type ActionItem } from '@immich/ui';
  import { mdiArrowLeft, mdiArrowRight, mdiDotsVertical, mdiTune, mdiVideoOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    asset: AssetResponseDto;
    album?: AlbumResponseDto | null;
    person?: PersonResponseDto | null;
    stack?: StackResponseDto | null;
    preAction: PreAction;
    onAction: OnAction;
    onUndoDelete?: OnUndoDelete;
    onClose?: () => void;
    onRemoveFromAlbum?: (assetIds: string[]) => void;
    isPlayingOriginalVideo: boolean;
    setPlayOriginalVideo: (value: boolean) => void;
  }

  let {
    asset,
    album = null,
    person = null,
    stack = null,
    preAction,
    onAction,
    onUndoDelete = undefined,
    onClose,
    onRemoveFromAlbum,
    isPlayingOriginalVideo = false,
    setPlayOriginalVideo,
  }: Props = $props();

  const isOwner = $derived(authManager.authenticated && asset.ownerId === authManager.user.id);
  const isAlbumOwner = $derived(authManager.authenticated && album?.albumUsers[0].user.id === authManager.user.id);
  const isLocked = $derived(asset.visibility === AssetVisibility.Locked);

  const { Cast } = $derived(getGlobalActions($t));

  const Close: ActionItem = $derived({
    title: $t('go_back'),
    icon: languageManager.rtl ? mdiArrowRight : mdiArrowLeft,
    $if: () => !!onClose && !assetViewerManager.isFaceEditMode && !assetViewerManager.isEditFacesPanelOpen,
    onAction: () => onClose?.(),
    shortcuts: [{ key: 'Escape' }],
  });

  const PlayOriginalVideo: ActionItem = $derived({
    title: isPlayingOriginalVideo ? $t('play_transcoded_video') : $t('play_original_video'),
    icon: mdiVideoOutline,
    $if: () => asset.type === AssetTypeEnum.Video,
    onAction: () => setPlayOriginalVideo(!isPlayingOriginalVideo),
  });

  const Actions = $derived(getAssetActions($t, { ...asset, stackPrimaryAssetId: stack?.primaryAssetId }));
  const sharedLink = getSharedLink();
  const showEdit = $derived(Actions.Edit.$if?.() ?? true);
</script>

<CommandPaletteDefaultProvider name={$t('assets')} actions={withoutIcons([Close, Cast, ...Object.values(Actions)])} />

<div
  class="flex h-16 place-items-center justify-between bg-linear-to-b from-black/40 px-3 drop-shadow-[0_0_1px_rgba(0,0,0,0.4)] transition-transform duration-200"
>
  <div class="dark">
    <ActionButton action={Close} />
  </div>

  <div
    class="dark -m-1 flex items-center gap-2 overflow-x-auto p-1 *:shrink-0"
    data-testid="asset-viewer-navbar-actions"
  >
    {#if assetViewerManager.isImageLoading}
      <Tooltip text={$t('loading')}>
        {#snippet child({ props })}
          <div {...props} role="status" aria-label={$t('loading')}>
            <LoadingDots class="me-1" />
          </div>
        {/snippet}
      </Tooltip>
    {/if}
    <ActionButton action={Cast} />
    <ActionButton action={Actions.Share} />
    <ActionButton action={Actions.Offline} />
    <ActionButton action={Actions.ZoomIn} />
    <ActionButton action={Actions.ZoomOut} />
    <ActionButton action={Actions.PlayMotionPhoto} />
    <ActionButton action={Actions.StopMotionPhoto} />
    <ActionButton action={Actions.Copy} />
    {#if isEnabled(Actions.SharedLinkDownload) || isEnabled(Actions.SharedLinkDownloadOriginal)}
      <div class="flex items-center gap-1">
        {#if isEnabled(Actions.SharedLinkDownload)}
          <button
            type="button"
            class="inline-flex items-center rounded-full border border-white/50 bg-white/20 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/35"
            aria-label={$t('download') + ' ' + Actions.SharedLinkDownload.title}
            title={$t('download') + ' ' + Actions.SharedLinkDownload.title}
            onclick={() => Actions.SharedLinkDownload.onAction()}
          >
            {Actions.SharedLinkDownload.title}
          </button>
        {/if}
        {#if isEnabled(Actions.SharedLinkDownloadOriginal)}
          <button
            type="button"
            class="inline-flex items-center rounded-full border border-amber-200/70 bg-amber-500/30 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-amber-500/45"
            aria-label={$t('download') + ' ' + Actions.SharedLinkDownloadOriginal.title}
            title={$t('download') + ' ' + Actions.SharedLinkDownloadOriginal.title}
            onclick={() => Actions.SharedLinkDownloadOriginal.onAction()}
          >
            {Actions.SharedLinkDownloadOriginal.title}
          </button>
        {/if}
      </div>
    {/if}

    {#if showEdit}
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/35"
        aria-label={$t('editor')}
        title={$t('editor')}
        onclick={() => Actions.Edit.onAction()}
      >
        <Icon icon={mdiTune} size="16" />
        {$t('editor')}
      </button>
    {/if}

    <ActionButton action={Actions.Info} />
    <ActionButton action={Actions.Favorite} />
    <ActionButton action={Actions.Unfavorite} />
    <ActionButton action={Actions.Feature} />
    <ActionButton action={Actions.Unfeature} />

    {#if isOwner}
      <RatingAction {asset} {onAction} />
    {/if}

    {#if isOwner}
      <DeleteAction {asset} {onAction} {preAction} {onUndoDelete} />
    {/if}

    {#if !sharedLink}
      <ButtonContextMenu direction="left" align="top-right" color="secondary" title={$t('more')} icon={mdiDotsVertical}>
        <ActionMenuItem action={Actions.PlaySlideshow} />

        <ActionMenuItem action={Actions.Download} />
        <ActionMenuItem action={Actions.DownloadOriginal} />

        {#if !isLocked && asset.isTrashed}
          <RestoreAction {asset} {onAction} />
        {/if}

        <ActionMenuItem action={Actions.AddToAlbum} />
        {#if album && (isOwner || isAlbumOwner)}
          <RemoveFromAlbumAction {album} onRemove={onRemoveFromAlbum} assetIds={[asset.id]} menuItem />
        {/if}

        {#if isOwner}
          <AddToStackAction {asset} {stack} {onAction} />
          {#if stack}
            <UnstackAction {stack} {onAction} />
            <KeepThisDeleteOthersAction {stack} {asset} {onAction} />
            {#if stack?.primaryAssetId !== asset.id}
              <SetStackPrimaryAsset {stack} {asset} {onAction} />
              {#if stack?.assets?.length > 2}
                <RemoveAssetFromStack {asset} {stack} {onAction} />
              {/if}
            {/if}
          {/if}
        {/if}
        {#if album}
          {@const { SetCover } = getAlbumAssetActions($t, album, asset)}
          <ActionMenuItem action={SetCover} />
        {/if}
        {#if person}
          <SetFeaturedPhotoAction {asset} {person} {onAction} />
        {/if}

        <ActionMenuItem action={Actions.SetProfilePicture} />

        {#if isOwner && !isLocked}
          <ArchiveAction {asset} {onAction} {preAction} />
        {/if}
        <ActionMenuItem action={Actions.ViewInTimeline} />
        <ActionMenuItem action={Actions.ViewSimilar} />

        {#if !asset.isTrashed && isOwner}
          <SetVisibilityAction asset={toTimelineAsset(asset)} {onAction} {preAction} />
        {/if}

        <ActionMenuItem action={PlayOriginalVideo} />

        {#if isOwner}
          <hr />
          <ActionMenuItem action={Actions.RefreshFacesJob} />
          <ActionMenuItem action={Actions.RefreshMetadataJob} />
          <ActionMenuItem action={Actions.RegenerateThumbnailJob} />
          <ActionMenuItem action={Actions.TranscodeVideoJob} />
        {/if}
      </ButtonContextMenu>
    {/if}

    {#if sharedLink}
      <button
        type="button"
        class="rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20"
        aria-label={$t('toggle_shared_standard_previews')}
        title={$t('toggle_shared_standard_previews')}
        onclick={() => ($preferUnenhancedSharedThumbnails = !$preferUnenhancedSharedThumbnails)}
      >
        {$preferUnenhancedSharedThumbnails ? $t('view_mode_standard') : $t('view_mode_enhanced')}
      </button>
    {/if}
  </div>
</div>
