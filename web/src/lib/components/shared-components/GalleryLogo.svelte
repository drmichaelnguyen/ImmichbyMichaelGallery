<script lang="ts">
  import { APP_NAME } from '$lib/constants/branding';
  import { mdiImageAlbum } from '@mdi/js';
  import { tv } from 'tailwind-variants';

  type Props = {
    size?: 'tiny' | 'small' | 'medium' | 'large' | 'giant' | 'landing';
    variant?: 'stacked' | 'inline' | 'logo' | 'icon' | 'stacked-futo';
    class?: string;
  };

  const { variant = 'logo', size = 'medium', class: className }: Props = $props();

  const showText = $derived(
    variant === 'inline' || variant === 'stacked' || variant === 'logo' || variant === 'stacked-futo',
  );

  const containerStyles = tv({
    variants: {
      size: {
        tiny: 'h-8',
        small: 'h-10',
        medium: 'h-12',
        large: 'h-16',
        giant: 'h-24',
        landing: 'h-64',
      },
    },
  });

  const textStyles = tv({
    variants: {
      size: {
        tiny: 'text-xs',
        small: 'text-sm',
        medium: 'text-lg',
        large: 'text-2xl',
        giant: 'text-4xl',
        landing: 'text-6xl',
      },
      variant: {
        stacked: 'flex-col items-center text-center leading-tight',
        inline: 'flex-row items-center whitespace-nowrap',
        logo: 'flex-col items-center text-center leading-tight',
        icon: '',
        'stacked-futo': 'flex-col items-center text-center leading-tight',
      },
    },
  });

  const iconStyles = tv({
    variants: {
      size: {
        tiny: 'size-5',
        small: 'size-6',
        medium: 'size-7',
        large: 'size-9',
        giant: 'size-14',
        landing: 'size-32',
      },
    },
  });
</script>

{#if showText}
  <span
    class="inline-flex font-semibold tracking-tight text-primary {containerStyles({ size })} {textStyles({
      size,
      variant,
    })} {className}"
    aria-label="{APP_NAME} logo"
  >
    {APP_NAME}
  </span>
{:else}
  <div
    class="inline-flex aspect-square items-center justify-center rounded-full bg-primary/10 text-primary {containerStyles({
      size,
    })} {className}"
    aria-label="{APP_NAME} logo"
  >
    <svg viewBox="0 0 24 24" class={iconStyles({ size })} aria-hidden="true">
      <path fill="currentColor" d={mdiImageAlbum} />
    </svg>
  </div>
{/if}
