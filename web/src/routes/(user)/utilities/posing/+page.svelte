<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import {
    createCustomPoseId,
    deleteCustomPose,
    getAllPoses,
    loadPosingSeed,
    posingLibraryStore,
    saveOverride,
    toggleFavorite,
    upsertCustomPose,
  } from '$lib/posing/posing.store';
  import { getPoseVisualRefs, mergePoseWithOverride } from '$lib/posing/refs';
  import { filterPoses, labelTag } from '$lib/posing/search';
  import type { PeopleCount, PoseFilters, PoseIdea, PoseOverride, PosingSeed } from '$lib/posing/types';
  import { handleError } from '$lib/utils/handle-error';
  import { fileUploadHandler, openFilePicker } from '$lib/utils/file-uploader';
  import { Button, Heading, Icon, Text, toastManager } from '@immich/ui';
  import {
    mdiHeart,
    mdiHeartOutline,
    mdiPlus,
    mdiClose,
    mdiDeleteOutline,
    mdiOpenInNew,
    mdiImageOutline,
    mdiUpload,
  } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let seed = $state<PosingSeed | null>(null);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let showEditor = $state(false);
  let brokenThumbs = $state<Record<string, boolean>>({});
  let uploading = $state(false);

  let filters = $state<PoseFilters>({
    query: '',
    people: 'all',
    background: '',
    object: '',
    favoritesOnly: false,
  });

  let draftNotes = $state('');
  let draftSampleBackground = $state('');
  let draftSampleObject = $state('');
  let draftSampleExample = $state('');
  let draftThumbnailUrl = $state('');
  let draftSearchPrompt = $state('');
  let draftAssetId = $state('');
  let draftTitle = $state('');
  let draftHowTo = $state('');

  let editTitle = $state('');
  let editPeople = $state<PeopleCount>('1');
  let editBackground = $state('');
  let editObject = $state('');
  let editHowTo = $state('');
  let editCameraTip = $state('');
  let editThumbnailUrl = $state('');
  let editSearchPrompt = $state('');
  let editAssetId = $state('');

  const library = $derived($posingLibraryStore);
  const favorites = $derived(new Set(library.favorites));
  const allPoses = $derived(seed ? getAllPoses(seed.poses, library) : []);
  const results = $derived(filterPoses(allPoses, filters, library.overrides, favorites));
  const selected = $derived(allPoses.find((pose) => pose.id === selectedId) ?? null);
  const selectedMerged = $derived(selected ? mergePoseWithOverride(selected, library.overrides[selected.id]) : null);
  const selectedRefs = $derived(selected ? getPoseVisualRefs(selected, library.overrides[selected.id]) : null);

  onMount(() => {
    void loadPosingSeed()
      .then((loaded) => {
        seed = loaded;
      })
      .catch((error: unknown) => {
        loadError = error instanceof Error ? error.message : String(error);
      });
  });

  const peopleLabel = (people: PeopleCount | 'all') => {
    if (people === 'all') {
      return $t('posing_people_all');
    }
    if (people === '1') {
      return $t('posing_people_one');
    }
    if (people === '2') {
      return $t('posing_people_two');
    }
    return $t('posing_people_couple');
  };

  const openPose = (pose: PoseIdea) => {
    selectedId = pose.id;
    showEditor = false;
    const override = library.overrides[pose.id];
    const merged = mergePoseWithOverride(pose, override);
    const refs = getPoseVisualRefs(pose, override);
    draftNotes = override?.notes ?? '';
    draftSampleBackground = override?.sampleBackground ?? '';
    draftSampleObject = override?.sampleObject ?? '';
    draftSampleExample = override?.sampleExample ?? '';
    draftThumbnailUrl = override?.thumbnailUrl ?? pose.thumbnailUrl ?? '';
    draftSearchPrompt = override?.searchPrompt ?? pose.searchPrompt ?? pose.freeImageSearch ?? refs.searchPrompt;
    draftAssetId = merged.assetId ?? '';
    draftTitle = merged.title;
    draftHowTo = merged.howTo;
  };

  const closeDetail = () => {
    selectedId = null;
    showEditor = false;
  };

  const persistSamples = () => {
    if (!selectedId || !selected) {
      return;
    }
    const override: PoseOverride = {
      notes: draftNotes,
      sampleBackground: draftSampleBackground,
      sampleObject: draftSampleObject,
      sampleExample: draftSampleExample,
      thumbnailUrl: draftThumbnailUrl,
      searchPrompt: draftSearchPrompt,
      assetId: draftAssetId,
      title: draftTitle !== selected.title ? draftTitle : undefined,
      howTo: draftHowTo !== selected.howTo ? draftHowTo : undefined,
    };

    if (selected.custom) {
      upsertCustomPose({
        ...selected,
        title: draftTitle.trim() || selected.title,
        howTo: draftHowTo.trim() || selected.howTo,
        thumbnailUrl: draftThumbnailUrl.trim() || undefined,
        searchPrompt: draftSearchPrompt.trim() || undefined,
        assetId: draftAssetId.trim() || undefined,
      });
    }

    saveOverride(selectedId, override);
    brokenThumbs = { ...brokenThumbs, [selectedId]: false };
    toastManager.success($t('saved'));
  };

  const openCreate = () => {
    selectedId = null;
    showEditor = true;
    editTitle = '';
    editPeople = filters.people === 'all' ? '1' : filters.people;
    editBackground = filters.background;
    editObject = filters.object === 'none' ? '' : filters.object;
    editHowTo = '';
    editCameraTip = '';
    editThumbnailUrl = '';
    editSearchPrompt = '';
    editAssetId = '';
  };

  const openEditCustom = (pose: PoseIdea) => {
    const merged = mergePoseWithOverride(pose, library.overrides[pose.id]);
    showEditor = true;
    editTitle = merged.title;
    editPeople = pose.people;
    editBackground = pose.background.join(', ');
    editObject = pose.object.filter((tag) => tag !== 'none').join(', ');
    editHowTo = merged.howTo;
    editCameraTip = pose.cameraTip;
    editThumbnailUrl = merged.thumbnailUrl ?? '';
    editSearchPrompt = merged.searchPrompt ?? pose.freeImageSearch ?? '';
    editAssetId = merged.assetId ?? '';
  };

  const parseTags = (value: string, fallback: string[]) =>
    value.trim()
      ? value
          .split(',')
          .map((tag) => tag.trim().toLowerCase().replaceAll(' ', '-'))
          .filter(Boolean)
      : fallback;

  const saveCustom = () => {
    if (!editTitle.trim() || !editHowTo.trim()) {
      return;
    }

    const id = selected?.custom ? selected.id : createCustomPoseId();
    const pose: PoseIdea = {
      id,
      title: editTitle.trim(),
      people: editPeople,
      background: parseTags(editBackground, ['plain-wall']),
      object: parseTags(editObject, ['none']),
      mood: ['casual'],
      poseType: ['standing'],
      howTo: editHowTo.trim(),
      cameraTip: editCameraTip.trim() || $t('posing_camera_tip_default'),
      thumbnailUrl: editThumbnailUrl.trim() || undefined,
      searchPrompt: editSearchPrompt.trim() || undefined,
      assetId: editAssetId.trim() || undefined,
      custom: true,
    };

    upsertCustomPose(pose);
    showEditor = false;
    openPose(pose);
  };

  const removeCustom = (pose: PoseIdea) => {
    deleteCustomPose(pose.id);
    closeDetail();
  };

  const markThumbBroken = (poseId: string) => {
    brokenThumbs = { ...brokenThumbs, [poseId]: true };
  };

  const uploadPosePhoto = async (target: 'editor' | 'detail') => {
    if (uploading) {
      return;
    }

    try {
      uploading = true;
      const files = await openFilePicker({
        multiple: false,
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
      });
      if (files.length === 0) {
        return;
      }

      const [assetId] = await fileUploadHandler({ files });
      if (!assetId) {
        throw new Error($t('errors.unable_to_upload_file'));
      }

      if (target === 'editor') {
        editAssetId = assetId;
        editThumbnailUrl = '';
      } else if (selectedId) {
        draftAssetId = assetId;
        draftThumbnailUrl = '';
        brokenThumbs = { ...brokenThumbs, [selectedId]: false };
        persistSamples();
      }

      toastManager.success($t('posing_upload_success'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_upload_file'));
    } finally {
      uploading = false;
    }
  };
</script>

<UserPageLayout title={data.meta.title} description={data.meta.description}>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 p-2 pb-10">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="max-w-2xl">
        <Text color="muted">{$t('posing_library_help')}</Text>
      </div>
      <Button size="small" leadingIcon={mdiPlus} onclick={openCreate}>{$t('posing_new_idea')}</Button>
    </div>

    <div class="rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-immich-dark-gray dark:bg-immich-dark-gray/40">
      <label class="mb-3 block">
        <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_search')}</Text>
        <input
          class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
          type="search"
          placeholder={$t('posing_search_placeholder')}
          bind:value={filters.query}
        />
      </label>

      <div class="mb-3 flex flex-wrap gap-2">
        {#each ['all', '1', '2', 'couple'] as peopleOption (peopleOption)}
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-sm transition-colors {filters.people === peopleOption
              ? 'border-immich-primary bg-immich-primary/10 text-immich-primary dark:border-immich-dark-primary dark:text-immich-dark-primary'
              : 'border-gray-300 dark:border-gray-700'}"
            onclick={() => (filters.people = peopleOption as PoseFilters['people'])}
          >
            {peopleLabel(peopleOption as PoseFilters['people'])}
          </button>
        {/each}
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm transition-colors {filters.favoritesOnly
            ? 'border-immich-primary bg-immich-primary/10 text-immich-primary dark:border-immich-dark-primary dark:text-immich-dark-primary'
            : 'border-gray-300 dark:border-gray-700'}"
          onclick={() => (filters.favoritesOnly = !filters.favoritesOnly)}
        >
          {$t('posing_favorites_only')}
        </button>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <label>
          <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_background')}</Text>
          <select
            class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            bind:value={filters.background}
          >
            <option value="">{$t('posing_any')}</option>
            {#each seed?.taxonomies.background ?? [] as tag (tag)}
              <option value={tag}>{labelTag(tag)}</option>
            {/each}
          </select>
        </label>
        <label>
          <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_object')}</Text>
          <select
            class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
            bind:value={filters.object}
          >
            <option value="">{$t('posing_any')}</option>
            {#each seed?.taxonomies.object ?? [] as tag (tag)}
              <option value={tag}>{labelTag(tag)}</option>
            {/each}
          </select>
        </label>
      </div>
    </div>

    {#if loadError}
      <Text class="text-red-500">{loadError}</Text>
    {:else if !seed}
      <Text color="muted">{$t('loading')}</Text>
    {:else}
      <Text size="small" color="muted">
        {$t('posing_result_count', { values: { count: results.length } })}
      </Text>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each results as pose (pose.id)}
          {@const merged = mergePoseWithOverride(pose, library.overrides[pose.id])}
          {@const refs = getPoseVisualRefs(pose, library.overrides[pose.id])}
          {@const showThumb = !!refs.thumbnailUrl && !brokenThumbs[pose.id]}
          <button
            type="button"
            class="overflow-hidden rounded-2xl border border-gray-200 text-start transition-colors hover:border-immich-primary dark:border-immich-dark-gray dark:hover:border-immich-dark-primary {selectedId ===
            pose.id
              ? 'border-immich-primary dark:border-immich-dark-primary'
              : ''}"
            onclick={() => openPose(pose)}
          >
            <div class="relative aspect-[4/3] bg-gray-100 dark:bg-gray-900">
              {#if showThumb}
                <img
                  src={refs.thumbnailUrl}
                  alt=""
                  class="h-full w-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror={() => markThumbBroken(pose.id)}
                />
              {:else}
                <div class="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <Icon icon={mdiImageOutline} class="text-gray-400" size="28" />
                  <Text size="tiny" color="muted" class="line-clamp-2">{refs.searchPrompt}</Text>
                </div>
              {/if}
            </div>
            <div class="p-4">
              <div class="mb-2 flex items-start justify-between gap-2">
                <Heading size="tiny" tag="h2" class="leading-snug">{merged.title}</Heading>
                <Icon
                  icon={favorites.has(pose.id) ? mdiHeart : mdiHeartOutline}
                  class={favorites.has(pose.id) ? 'text-red-500' : 'text-gray-400'}
                  size="18"
                />
              </div>
              <Text size="small" color="muted" class="mb-3 line-clamp-2">{merged.howTo}</Text>
              <div class="flex flex-wrap gap-1">
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{peopleLabel(pose.people)}</span>
                {#each pose.background.slice(0, 2) as tag (tag)}
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{labelTag(tag)}</span>
                {/each}
                {#each pose.object.filter((tag) => tag !== 'none').slice(0, 2) as tag (tag)}
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{labelTag(tag)}</span>
                {/each}
                {#if pose.custom}
                  <span
                    class="rounded-full bg-immich-primary/10 px-2 py-0.5 text-xs text-immich-primary dark:text-immich-dark-primary"
                    >{$t('posing_custom')}</span
                  >
                {/if}
              </div>
            </div>
          </button>
        {:else}
          <div class="col-span-full rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <Text color="muted">{$t('posing_no_results')}</Text>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if selected || showEditor}
    <div class="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onclick={closeDetail}>
      <aside
        class="flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto bg-white p-5 shadow-2xl dark:bg-immich-dark-gray"
        role="dialog"
        aria-modal="true"
        onclick={(event) => event.stopPropagation()}
      >
        <div class="flex items-center justify-between gap-2">
          <Heading size="small" tag="h2">{showEditor ? $t('posing_new_idea') : selectedMerged?.title}</Heading>
          <Button size="small" color="secondary" shape="round" leadingIcon={mdiClose} onclick={closeDetail} aria-label={$t('close')} />
        </div>

        {#if showEditor}
          <div class="rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
            <Text size="small" color="muted" class="mb-3">{$t('posing_upload_hint')}</Text>
            <Button
              size="small"
              color="secondary"
              leadingIcon={mdiUpload}
              loading={uploading}
              disabled={uploading}
              onclick={() => uploadPosePhoto('editor')}
            >
              {uploading ? $t('posing_uploading') : $t('posing_upload_photo')}
            </Button>
            {#if editAssetId}
              {@const preview = getPoseVisualRefs(
                {
                  id: 'preview',
                  title: editTitle || 'preview',
                  people: editPeople,
                  background: [],
                  object: [],
                  mood: [],
                  poseType: [],
                  howTo: '',
                  cameraTip: '',
                  assetId: editAssetId,
                },
                undefined,
              )}
              {#if preview.thumbnailUrl}
                <img src={preview.thumbnailUrl} alt="" class="mt-3 max-h-48 w-full rounded-xl object-cover" />
              {/if}
            {/if}
          </div>

          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_title')}</Text>
            <input class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700" bind:value={editTitle} />
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_people')}</Text>
            <select class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700" bind:value={editPeople}>
              <option value="1">{peopleLabel('1')}</option>
              <option value="2">{peopleLabel('2')}</option>
              <option value="couple">{peopleLabel('couple')}</option>
            </select>
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_background_tags')}</Text>
            <input
              class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
              placeholder="stairs, golden hour"
              bind:value={editBackground}
            />
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_object_tags')}</Text>
            <input
              class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
              placeholder="chair, flowers"
              bind:value={editObject}
            />
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_how_to')}</Text>
            <textarea class="min-h-28 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700" bind:value={editHowTo}
            ></textarea>
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_camera_tip')}</Text>
            <textarea class="min-h-20 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700" bind:value={editCameraTip}
            ></textarea>
          </label>
          <label>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_search_prompt')}</Text>
            <input
              class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
              placeholder={$t('posing_search_prompt_placeholder')}
              bind:value={editSearchPrompt}
            />
          </label>
          <div class="flex gap-2">
            <Button onclick={saveCustom}>{$t('save')}</Button>
            <Button color="secondary" onclick={() => (showEditor = false)}>{$t('cancel')}</Button>
          </div>
        {:else if selected && selectedMerged && selectedRefs}
          <div class="flex flex-wrap gap-2">
            <Button
              size="small"
              color="secondary"
              leadingIcon={favorites.has(selected.id) ? mdiHeart : mdiHeartOutline}
              onclick={() => toggleFavorite(selected.id)}
            >
              {favorites.has(selected.id) ? $t('posing_unfavorite') : $t('posing_favorite')}
            </Button>
            <Button
              size="small"
              color="secondary"
              leadingIcon={mdiUpload}
              loading={uploading}
              disabled={uploading}
              onclick={() => uploadPosePhoto('detail')}
            >
              {uploading ? $t('posing_uploading') : $t('posing_upload_photo')}
            </Button>
            {#if selected.custom}
              <Button size="small" color="secondary" onclick={() => openEditCustom(selected)}>{$t('edit')}</Button>
              <Button size="small" color="secondary" leadingIcon={mdiDeleteOutline} onclick={() => removeCustom(selected)}
                >{$t('delete')}</Button
              >
            {/if}
          </div>

          {#if selectedRefs.thumbnailUrl && !brokenThumbs[selected.id]}
            <img
              src={selectedRefs.thumbnailUrl}
              alt=""
              class="max-h-64 w-full rounded-xl object-cover"
              referrerpolicy="no-referrer"
              onerror={() => markThumbBroken(selected.id)}
            />
          {:else if selectedRefs.thumbnailUrl && brokenThumbs[selected.id]}
            <Text size="small" color="muted">{$t('posing_thumbnail_broken')}</Text>
          {/if}

          <div class="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
            <Heading size="tiny" tag="h3" class="mb-2">{$t('posing_reference_links')}</Heading>
            <Text size="small" color="muted" class="mb-3">{selectedRefs.searchPrompt}</Text>
            <div class="flex flex-wrap gap-2">
              <Button
                size="small"
                color="secondary"
                leadingIcon={mdiOpenInNew}
                href={selectedRefs.pinterestUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {$t('posing_open_pinterest')}
              </Button>
              <Button
                size="small"
                color="secondary"
                leadingIcon={mdiOpenInNew}
                href={selectedRefs.googleImagesUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {$t('posing_open_google')}
              </Button>
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
            <Heading size="tiny" tag="h3" class="mb-3">{$t('posing_my_description')}</Heading>
            <Text size="small" color="muted" class="mb-3">{$t('posing_upload_hint')}</Text>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_my_title')}</Text>
              <input
                class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                bind:value={draftTitle}
              />
            </label>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_how_to')}</Text>
              <textarea
                class="min-h-28 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                bind:value={draftHowTo}
              ></textarea>
            </label>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_search_prompt')}</Text>
              <input
                class="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                placeholder={$t('posing_search_prompt_placeholder')}
                bind:value={draftSearchPrompt}
              />
            </label>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_sample_background')}</Text>
              <textarea
                class="min-h-16 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                placeholder={$t('posing_sample_background_placeholder')}
                bind:value={draftSampleBackground}
              ></textarea>
            </label>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_sample_object')}</Text>
              <textarea
                class="min-h-16 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                placeholder={$t('posing_sample_object_placeholder')}
                bind:value={draftSampleObject}
              ></textarea>
            </label>
            <label class="mb-3 block">
              <Text size="small" fontWeight="medium" class="mb-1">{$t('notes')}</Text>
              <textarea
                class="min-h-16 w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                bind:value={draftNotes}
              ></textarea>
            </label>
            <Button size="small" onclick={persistSamples}>{$t('posing_save_samples')}</Button>
          </div>

          <div class="flex flex-wrap gap-1">
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{peopleLabel(selected.people)}</span>
            {#each selected.background as tag (tag)}
              <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{labelTag(tag)}</span>
            {/each}
            {#each selected.object as tag (tag)}
              <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{labelTag(tag)}</span>
            {/each}
          </div>

          <div>
            <Text size="small" fontWeight="medium" class="mb-1">{$t('posing_camera_tip')}</Text>
            <Text color="muted">{selected.cameraTip}</Text>
          </div>
        {/if}
      </aside>
    </div>
  {/if}
</UserPageLayout>
