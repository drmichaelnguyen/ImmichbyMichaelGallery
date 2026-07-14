<script lang="ts">
  import SharedLinkExpiration from '$lib/components/SharedLinkExpiration.svelte';
  import { Field, Input, PasswordInput, Switch, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';

  type Props = {
    slug: string;
    password: string;
    description: string;
    allowDownload: boolean;
    allowUpload: boolean;
    uploadPassword: string;
    showMetadata: boolean;
    expiresAt: string | null;
    uploadExpiresAt: string | null;
  };

  let {
    slug = $bindable(),
    password = $bindable(),
    description = $bindable(),
    allowDownload = $bindable(),
    allowUpload = $bindable(),
    uploadPassword = $bindable(),
    showMetadata = $bindable(),
    expiresAt = $bindable(),
    uploadExpiresAt = $bindable(),
  }: Props = $props();

  $effect(() => {
    if (!showMetadata && allowDownload) {
      allowDownload = false;
    }
  });

  $effect(() => {
    if (!allowUpload) {
      uploadExpiresAt = null;
      uploadPassword = '';
    }
  });
</script>

<div class="mt-4 flex flex-col gap-4">
  <div>
    <Field label={$t('custom_url')} description={$t('shared_link_custom_url_description')}>
      <Input bind:value={slug} autocomplete="off" />
    </Field>
    {#if slug}
      <Text size="tiny" color="muted" class="pt-2 break-all">/s/{encodeURIComponent(slug)}</Text>
    {/if}
  </div>

  <Field label={$t('password')} description={$t('shared_link_password_description')}>
    <PasswordInput bind:value={password} autocomplete="new-password" />
  </Field>

  <Field label={$t('description')}>
    <Input bind:value={description} autocomplete="off" />
  </Field>

  <SharedLinkExpiration
    bind:expiresAt
    label={$t('link_expires_after')}
    description={$t('shared_link_expire_description')}
  />

  <Field label={$t('show_metadata')}>
    <Switch bind:checked={showMetadata} />
  </Field>

  <Field label={$t('allow_public_user_to_download')} disabled={!showMetadata}>
    <Switch bind:checked={allowDownload} />
  </Field>

  <div class="rounded-xl border border-gray-200 p-3 dark:border-immich-dark-gray">
    <Field label={$t('allow_public_user_to_upload')} description={$t('allow_public_user_to_upload_description')}>
      <Switch bind:checked={allowUpload} />
    </Field>

    {#if allowUpload}
      <div class="mt-4 flex flex-col gap-4">
        <Field label={$t('upload_password')} description={$t('upload_password_description')}>
          <PasswordInput bind:value={uploadPassword} autocomplete="new-password" />
        </Field>

        <SharedLinkExpiration
          bind:expiresAt={uploadExpiresAt}
          label={$t('upload_until')}
          description={$t('shared_link_upload_expire_description')}
        />
      </div>
    {/if}
  </div>
</div>
