<script lang="ts">
  import { Field, FormModal, PasswordInput, Text } from '@immich/ui';
  import { mdiLockOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    onClose: (password?: string) => void;
  }

  let { onClose }: Props = $props();
  let password = $state('');

  const onSubmit = async () => {
    onClose(password);
  };
</script>

<FormModal
  title={$t('upload_password_required')}
  icon={mdiLockOutline}
  size="small"
  onClose={() => onClose()}
  {onSubmit}
  submitText={$t('continue')}
>
  <Text class="mb-4">{$t('upload_password_prompt')}</Text>
  <Field label={$t('upload_password')}>
    <PasswordInput bind:value={password} autocomplete="current-password" />
  </Field>
</FormModal>
