<script lang="ts">
  import AdminPageLayout from '$lib/components/layouts/AdminPageLayout.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import { Route } from '$lib/route';
  import { getUserAdminActions, getUserAdminsActions } from '$lib/services/user-admin.service';
  import { locale } from '$lib/stores/preferences.store';
  import { getByteUnitString } from '$lib/utils/byte-units';
  import { searchUsersAdmin, UserStatus, type UserAdminResponseDto } from '@immich/sdk';
  import {
    CommandPaletteDefaultProvider,
    Container,
    ContextMenuButton,
    Icon,
    Link,
    MenuItemType,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    Text,
  } from '@immich/ui';
  import { mdiInfinity } from '@mdi/js';
  import type { Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { LayoutData } from './$types';

  type Props = {
    children?: Snippet;
    data: LayoutData;
  };

  let { children, data }: Props = $props();

  let users: UserAdminResponseDto[] = $state(data.users);

  const onUpdate = async (user: UserAdminResponseDto) => {
    const index = users.findIndex(({ id }) => id === user.id);
    if (index === -1) {
      users = await searchUsersAdmin({ withDeleted: true });
    } else {
      users[index] = user;
    }
  };

  const onUserAdminDeleted = ({ id: userId }: { id: string }) => {
    users = users.filter(({ id }) => id !== userId);
  };

  const { Create } = $derived(getUserAdminsActions($t));

  const getActionsForUser = (user: UserAdminResponseDto) => {
    const { Detail, Update, Delete, Approve, ResetPassword, ResetPinCode } = getUserAdminActions($t, user);
    return [Detail, Update, Approve, ResetPassword, ResetPinCode, MenuItemType.Divider, Delete];
  };

  const statusLabel = (user: UserAdminResponseDto) => {
    if (user.deletedAt) {
      return $t('user_deleted');
    }
    if (user.status === UserStatus.PendingApproval) {
      return $t('pending_approval');
    }
    if (user.isAdmin) {
      return $t('admin.admin_user');
    }
    return $t('active');
  };

  const classes = {
    column1: 'w-8/12 md:w-5/12 lg:w-4/12',
    column2: 'hidden md:block md:w-5/12 lg:w-4/12',
    column3: 'hidden lg:block lg:w-2/12',
    column4: 'w-4/12 md:w-2/12 flex justify-end',
  };
</script>

<OnEvents
  onUserAdminCreate={onUpdate}
  onUserAdminUpdate={onUpdate}
  onUserAdminDelete={onUpdate}
  onUserAdminRestore={onUpdate}
  {onUserAdminDeleted}
/>

<CommandPaletteDefaultProvider name={$t('users')} actions={[Create]} />

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]} actions={[Create]}>
  <Container center size="large">
    <Table class="mt-4" striped spacing="small" size="small">
      <TableHeader>
        <TableHeading class={classes.column1}>{$t('name')}</TableHeading>
        <TableHeading class={classes.column2}>{$t('email')}</TableHeading>
        <TableHeading class={classes.column3}>{$t('status')}</TableHeading>
      </TableHeader>

      <TableBody>
        {#each users as user (user.id)}
          <TableRow
            color={user.deletedAt ? 'danger' : user.status === UserStatus.PendingApproval ? 'warning' : undefined}
          >
            <TableCell class={classes.column1}>
              <Link href={Route.viewUser(user)}>{user.name}</Link>
              {#if user.quotaSizeInBytes !== null && user.quotaSizeInBytes >= 0}
                <Text size="tiny" color="muted" class="ms-2">{getByteUnitString(user.quotaSizeInBytes, $locale)}</Text>
              {:else}
                <Icon icon={mdiInfinity} size="14" class="ms-2 inline text-gray-400" />
              {/if}
            </TableCell>
            <TableCell class={classes.column2}>{user.email}</TableCell>
            <TableCell class={classes.column3}>
              <span
                class="rounded-full px-2 py-0.5 text-xs {user.status === UserStatus.PendingApproval
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}"
              >
                {statusLabel(user)}
              </span>
            </TableCell>
            <TableCell class={classes.column4}>
              <ContextMenuButton color="primary" aria-label={$t('open')} items={getActionsForUser(user)} />
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>

    {@render children?.()}
  </Container>
</AdminPageLayout>
