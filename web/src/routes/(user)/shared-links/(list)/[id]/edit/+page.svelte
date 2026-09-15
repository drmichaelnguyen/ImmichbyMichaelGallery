<script lang="ts">
  import { goto } from '$app/navigation';
  import SharedLinkFormFields from '$lib/components/SharedLinkFormFields.svelte';
  import { Route } from '$lib/route';
  import { handleUpdateSharedLink } from '$lib/services/shared-link.service';
  import { SharedLinkType } from '@immich/sdk';
  import { FormModal } from '@immich/ui';
  import { mdiLink } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  let { data }: Props = $props();

  const sharedLink = $state(data.sharedLink);

  let description = $state(sharedLink.description ?? '');
  let allowDownload = $state(sharedLink.allowDownload);
  let allowUpload = $state(sharedLink.allowUpload);
  let showMetadata = $state(sharedLink.showMetadata);
  let password = $state(sharedLink.password ?? '');
  let uploadPassword = $state(sharedLink.uploadPassword ?? '');
  let slug = $state(sharedLink.slug ?? '');
  let shareType = sharedLink.album ? SharedLinkType.Album : SharedLinkType.Individual;
  let expiresAt = $state(sharedLink.expiresAt);
  let uploadExpiresAt = $state(sharedLink.uploadExpiresAt ?? null);

  const onClose = async () => {
    await goto(Route.sharedLinks());
  };

  const onSubmit = async () => {
    const success = await handleUpdateSharedLink(sharedLink, {
      description,
      password: password ?? null,
      uploadPassword: allowUpload ? uploadPassword || null : null,
      expiresAt,
      uploadExpiresAt: allowUpload ? uploadExpiresAt : null,
      allowUpload,
      allowDownload,
      showMetadata,
      slug: slug.trim() ?? null,
    });
    if (success) {
      await onClose();
    }
  };
</script>

<FormModal title={$t('edit_link')} icon={mdiLink} {onClose} {onSubmit} submitText={$t('confirm')} size="small">
  {#if shareType === SharedLinkType.Album}
    <div class="text-sm">
      {$t('public_album')} |
      <span class="text-primary">{sharedLink.album?.albumName}</span>
    </div>
  {/if}

  {#if shareType === SharedLinkType.Individual}
    <div class="text-sm">
      {$t('individual_share')} |
      <span class="text-primary">{sharedLink.description || ''}</span>
    </div>
  {/if}

  <SharedLinkFormFields
    bind:slug
    bind:password
    bind:description
    bind:allowDownload
    bind:allowUpload
    bind:uploadPassword
    bind:showMetadata
    bind:expiresAt
    bind:uploadExpiresAt
  />
</FormModal>
