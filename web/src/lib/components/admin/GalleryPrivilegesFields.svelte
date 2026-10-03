<script lang="ts">
  import type { GalleryPrivileges } from '$lib/utils/privileges';
  import { Field, Stack, Switch, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';

  type Props = {
    privileges: GalleryPrivileges;
  };

  let { privileges = $bindable() }: Props = $props();
</script>

<Stack gap={3}>
  <Text size="small" color="muted">{$t('admin.gallery_privileges_description')}</Text>
  <Field label={$t('admin.privilege_view_featured')}>
    <Switch bind:checked={privileges.viewFeatured} />
  </Field>
  <Field label={$t('admin.privilege_download')}>
    <Switch bind:checked={privileges.download} />
  </Field>
  <Field label={$t('admin.privilege_upload')}>
    <Switch bind:checked={privileges.upload} />
  </Field>
  <Field label={$t('admin.privilege_edit')}>
    <Switch bind:checked={privileges.edit} />
  </Field>
  <Field label={$t('admin.privilege_delete')}>
    <Switch bind:checked={privileges.delete} />
  </Field>
</Stack>
