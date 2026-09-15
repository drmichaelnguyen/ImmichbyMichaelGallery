<script lang="ts">
  import { Field, FormModal, Input, Text } from '@immich/ui';
  import { mdiAccountEditOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  export type SharedLinkContributorInfo = {
    name: string;
    email: string;
  };

  interface Props {
    onClose: (info?: SharedLinkContributorInfo) => void;
    initialName?: string;
    initialEmail?: string;
  }

  let { onClose, initialName = '', initialEmail = '' }: Props = $props();

  let name = $state(initialName);
  let email = $state(initialEmail);
  let error = $state('');

  const onSubmit = async () => {
    error = '';
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      error = $t('contributor_name_required');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      error = $t('contributor_email_required');
      return;
    }

    onClose({ name: trimmedName, email: trimmedEmail });
  };
</script>

<FormModal
  title={$t('contributor_info_title')}
  icon={mdiAccountEditOutline}
  size="small"
  onClose={() => onClose()}
  {onSubmit}
  submitText={$t('continue')}
>
  <Text class="mb-4">{$t('contributor_info_description')}</Text>

  <div class="flex flex-col gap-4">
    <Field label={$t('name')}>
      <Input bind:value={name} autocomplete="name" />
    </Field>
    <Field label={$t('email')}>
      <Input bind:value={email} type="email" autocomplete="email" />
    </Field>
    {#if error}
      <Text color="danger" size="small">{error}</Text>
    {/if}
  </div>
</FormModal>
