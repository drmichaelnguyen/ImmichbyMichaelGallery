<script lang="ts">
  import UserAvatar from '$lib/components/shared-components/UserAvatar.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { Route } from '$lib/route';
  import { createAlbumFromSelection, type AlbumFromSelectionResponse } from '$lib/services/album-selection.service';
  import { handleError } from '$lib/utils/handle-error';
  import { normalizeSearchString } from '$lib/utils/string-utils';
  import { AlbumUserRole, searchUsers, type UserResponseDto } from '@immich/sdk';
  import { Button, Field, FormModal, Input, Stack, Switch, Text } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = {
    albumIds?: string[];
    personIds?: string[];
    onClose: (result?: AlbumFromSelectionResponse) => void;
  };

  let { albumIds = [], personIds = [], onClose }: Props = $props();

  let albumName = $state('');
  let shareMode = $state<'public' | 'user'>('public');
  let allowDownload = $state(true);
  let role = $state<AlbumUserRole.Viewer | AlbumUserRole.Editor>(AlbumUserRole.Viewer);
  let users = $state<UserResponseDto[]>([]);
  let userSearch = $state('');
  let selectedUserId = $state('');
  let saving = $state(false);
  let created = $state<AlbumFromSelectionResponse>();

  const filteredUsers = $derived(
    users.filter(
      (user) =>
        user.id !== authManager.user.id &&
        normalizeSearchString(`${user.name} ${user.email}`).includes(normalizeSearchString(userSearch)),
    ),
  );

  const publicUrl = $derived(
    created?.sharedLinkKey
      ? `${globalThis.location?.origin ?? ''}${Route.viewSharedLink({
          key: created.sharedLinkKey,
          slug: created.sharedLinkSlug,
        })}`
      : '',
  );

  const canSubmit = $derived(
    albumName.trim().length > 0 && !saving && (shareMode === 'public' || selectedUserId.length > 0),
  );

  onMount(async () => {
    try {
      users = await searchUsers();
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_users'));
    }
  });

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (created) {
      onClose(created);
      return;
    }

    if (!canSubmit) {
      return;
    }

    saving = true;
    try {
      created = await createAlbumFromSelection({
        albumName: albumName.trim(),
        albumIds: albumIds.length > 0 ? albumIds : undefined,
        personIds: personIds.length > 0 ? personIds : undefined,
        share:
          shareMode === 'public'
            ? { mode: 'public', allowDownload }
            : { mode: 'user', userId: selectedUserId, role },
      });

      if (!created.sharedLinkKey) {
        onClose(created);
      }
    } catch (error) {
      handleError(error, $t('errors.unable_to_create_shared_album'));
    } finally {
      saving = false;
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
  };
</script>

<FormModal
  title={$t('create_shared_album')}
  size="medium"
  submitText={created ? $t('done') : $t('create')}
  disabled={!created && !canSubmit}
  {onSubmit}
  onClose={() => onClose(created)}
>
  {#if created?.sharedLinkKey}
    <Stack gap={3}>
      <Text>{$t('shared_album_public_ready')}</Text>
      <Input readonly value={publicUrl} />
      <Button type="button" variant="ghost" onclick={copyLink}>{$t('copy_link')}</Button>
    </Stack>
  {:else}
    <Stack gap={4}>
      <Text color="muted" size="small">{$t('create_shared_album_description')}</Text>
      <Field label={$t('name')} required>
        <Input bind:value={albumName} />
      </Field>

      <div class="flex gap-2">
        <Button type="button" color={shareMode === 'public' ? 'primary' : 'secondary'} onclick={() => (shareMode = 'public')}>
          {$t('share_publicly')}
        </Button>
        <Button type="button" color={shareMode === 'user' ? 'primary' : 'secondary'} onclick={() => (shareMode = 'user')}>
          {$t('share_with_user')}
        </Button>
      </div>

      {#if shareMode === 'public'}
        <Field label={$t('allow_public_download')}>
          <Switch bind:checked={allowDownload} />
        </Field>
      {:else}
        <Field label={$t('access')}>
          <div class="flex gap-2">
            <Button
              type="button"
              color={role === AlbumUserRole.Viewer ? 'primary' : 'secondary'}
              onclick={() => (role = AlbumUserRole.Viewer)}
            >
              {$t('role_viewer')}
            </Button>
            <Button
              type="button"
              color={role === AlbumUserRole.Editor ? 'primary' : 'secondary'}
              onclick={() => (role = AlbumUserRole.Editor)}
            >
              {$t('editor')}
            </Button>
          </div>
        </Field>
        <Input bind:value={userSearch} placeholder={$t('search')} />
        <div class="max-h-64 overflow-y-auto">
          {#each filteredUsers as user (user.id)}
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-800 {selectedUserId ===
              user.id
                ? 'bg-primary/10'
                : ''}"
              onclick={() => (selectedUserId = user.id)}
            >
              <UserAvatar {user} size="md" />
              <span>
                <span class="block font-medium">{user.name}</span>
                <span class="block text-sm text-gray-500">{user.email}</span>
              </span>
            </button>
          {:else}
            <Text color="muted" size="small">{$t('no_users_found')}</Text>
          {/each}
        </div>
      {/if}
    </Stack>
  {/if}
</FormModal>
