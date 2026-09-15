<script lang="ts">
  import { localManager } from '$lib/managers/edit/local-manager.svelte';
  import { getAssetMediaUrl } from '$lib/utils';
  import { cssFilterFromColorAdjust } from '$lib/utils/color-adjust';
  import { getAltText } from '$lib/utils/thumbnail-util';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import { AssetMediaSize, type AssetResponseDto, type BrushPoint, type LocalMaskShape } from '@immich/sdk';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    asset: AssetResponseDto;
  }

  let { asset }: Props = $props();

  let container = $state<HTMLElement | null>(null);
  let imgEl = $state<HTMLImageElement | null>(null);
  let overlayCanvas = $state<HTMLCanvasElement | null>(null);
  let painting = $state(false);
  let dragStart = $state<{ x: number; y: number } | null>(null);
  let maskDataUrl = $state<string | null>(null);
  let displayWidth = $state(0);
  let displayHeight = $state(0);

  /** Offscreen grayscale mask: white = selected, black = not. */
  let maskCanvas: HTMLCanvasElement | null = null;

  let imageSrc = $derived(
    getAssetMediaUrl({
      id: asset.id,
      cacheKey: asset.thumbhash,
      edited: asset.isEdited,
      size: AssetMediaSize.Preview,
    }),
  );

  const activeFilter = $derived.by(() => {
    if (!localManager.hasActiveAdjustments()) {
      return undefined;
    }
    return cssFilterFromColorAdjust(localManager.activeAdjustments());
  });

  const showAdjustedPreview = $derived(!!activeFilter && !!maskDataUrl);

  const pointerToNorm = (event: PointerEvent): BrushPoint | null => {
    if (!imgEl) {
      return null;
    }
    const rect = imgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return {
      x,
      y,
      size: localManager.brushSize,
      hardness: localManager.brushHardness,
      opacity: localManager.brushOpacity,
    };
  };

  const ensureMaskCanvas = (width: number, height: number) => {
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas');
    }
    if (maskCanvas.width !== width || maskCanvas.height !== height) {
      maskCanvas.width = width;
      maskCanvas.height = height;
    }
    return maskCanvas;
  };

  const drawBrushStamps = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    points: BrushPoint[],
    erase: boolean,
  ) => {
    const minDim = Math.min(width, height);
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      const next = points[i + 1];
      const stamps = next
        ? Math.max(
            1,
            Math.ceil(
              Math.hypot((next.x - point.x) * width, (next.y - point.y) * height) /
                Math.max(1, point.size * minDim * 0.35),
            ),
          )
        : 1;
      for (let s = 0; s < stamps; s++) {
        const t = stamps === 1 ? 0 : s / stamps;
        const x = (next ? point.x + (next.x - point.x) * t : point.x) * width;
        const y = (next ? point.y + (next.y - point.y) * t : point.y) * height;
        const size = (next ? point.size + (next.size - point.size) * t : point.size) * minDim;
        const hardness = next ? point.hardness + (next.hardness - point.hardness) * t : point.hardness;
        const opacity = next ? point.opacity + (next.opacity - point.opacity) * t : point.opacity;
        const radius = Math.max(0.5, size / 2);
        const gradient = ctx.createRadialGradient(x, y, radius * hardness, x, y, radius);
        // Grayscale mask: white adds selection, black erases.
        const color = erase ? `rgba(0,0,0,${opacity})` : `rgba(255,255,255,${opacity})`;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const paintShapeToMask = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    shape: LocalMaskShape,
  ) => {
    if (shape.type === 'brush') {
      for (const stroke of shape.strokes) {
        drawBrushStamps(ctx, width, height, stroke.points, !!stroke.erase);
      }
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = shape.mode === 'subtract' ? 'destination-out' : 'source-over';

    if (shape.type === 'radial') {
      const cx = shape.cx * width;
      const cy = shape.cy * height;
      const rx = shape.radiusX * width;
      const ry = shape.radiusY * height;
      const feather = shape.feather ?? 0.4;
      const gradient = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * (1 - feather), cx, cy, Math.max(rx, ry));
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape.type === 'linear') {
      const x1 = shape.x1 * width;
      const y1 = shape.y1 * height;
      const x2 = shape.x2 * width;
      const y2 = shape.y2 * height;
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  };

  const rebuildMask = (options?: { publishUrl?: boolean }) => {
    if (!overlayCanvas || !imgEl) {
      return;
    }

    const width = overlayCanvas.width;
    const height = overlayCanvas.height;
    if (width <= 0 || height <= 0) {
      return;
    }

    const mask = ensureMaskCanvas(width, height);
    const maskCtx = mask.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!maskCtx || !overlayCtx) {
      return;
    }

    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, width, height);

    const activeMask = localManager.activeMask;
    const hasShapeContent = !!activeMask?.shapes.some((shape) =>
      shape.type === 'brush' ? shape.strokes.some((stroke) => stroke.points.length > 0) : true,
    );

    if (activeMask && hasShapeContent) {
      for (const shape of activeMask.shapes) {
        paintShapeToMask(maskCtx, width, height, shape);
      }

      if (activeMask.invert) {
        maskCtx.globalCompositeOperation = 'difference';
        maskCtx.fillStyle = 'white';
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.globalCompositeOperation = 'source-over';
      }

      const opacity = Math.max(0, Math.min(1, activeMask.opacity ?? 1));
      if (opacity < 1) {
        maskCtx.globalCompositeOperation = 'destination-in';
        maskCtx.fillStyle = `rgba(255,255,255,${opacity})`;
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.globalCompositeOperation = 'source-over';
      }
    }

    if (localManager.draftShape) {
      paintShapeToMask(maskCtx, width, height, localManager.draftShape);
    }

    // Light pink guide — keep the photo readable underneath.
    overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.clearRect(0, 0, width, height);
    if (localManager.showMaskOverlay && (hasShapeContent || localManager.draftShape)) {
      overlayCtx.save();
      overlayCtx.fillStyle = 'rgba(255, 64, 129, 0.22)';
      overlayCtx.fillRect(0, 0, width, height);
      overlayCtx.globalCompositeOperation = 'destination-in';
      overlayCtx.drawImage(mask, 0, 0);
      overlayCtx.restore();
    }

    if (localManager.draftShape) {
      const draft = localManager.draftShape;
      overlayCtx.save();
      overlayCtx.strokeStyle = 'rgba(255,255,255,0.85)';
      overlayCtx.lineWidth = Math.max(1, width / 400);
      if (draft.type === 'radial') {
        overlayCtx.beginPath();
        overlayCtx.ellipse(
          draft.cx * width,
          draft.cy * height,
          draft.radiusX * width,
          draft.radiusY * height,
          0,
          0,
          Math.PI * 2,
        );
        overlayCtx.stroke();
      } else if (draft.type === 'linear') {
        overlayCtx.beginPath();
        overlayCtx.moveTo(draft.x1 * width, draft.y1 * height);
        overlayCtx.lineTo(draft.x2 * width, draft.y2 * height);
        overlayCtx.stroke();
      }
      overlayCtx.restore();
    }

    const publishUrl = options?.publishUrl ?? !painting;
    if (publishUrl) {
      maskDataUrl = hasShapeContent || !!localManager.draftShape ? mask.toDataURL('image/png') : null;
    }
  };

  const syncCanvasSize = () => {
    if (!imgEl || !overlayCanvas) {
      return;
    }
    const rect = imgEl.getBoundingClientRect();
    displayWidth = rect.width;
    displayHeight = rect.height;
    const dpr = window.devicePixelRatio || 1;
    overlayCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    overlayCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    overlayCanvas.style.width = `${rect.width}px`;
    overlayCanvas.style.height = `${rect.height}px`;
    rebuildMask({ publishUrl: true });
  };

  $effect(() => {
    void localManager.masks;
    void localManager.activeMaskId;
    void localManager.showMaskOverlay;
    void localManager.draftShape;
    void localManager.activeAdjustments();
    // While painting, pointer handlers refresh the pink overlay; delay CSS-mask publish until pointer up.
    rebuildMask({ publishUrl: !painting });
  });

  const onPointerDown = (event: PointerEvent) => {
    const point = pointerToNorm(event);
    if (!point || !overlayCanvas) {
      return;
    }
    overlayCanvas.setPointerCapture(event.pointerId);
    painting = true;
    dragStart = { x: point.x, y: point.y };

    if (localManager.mode === 'brush' || localManager.mode === 'erase') {
      localManager.beginBrushStroke(point, localManager.mode === 'erase');
    } else if (localManager.mode === 'radial') {
      localManager.draftShape = {
        type: 'radial',
        cx: point.x,
        cy: point.y,
        radiusX: 0.01,
        radiusY: 0.01,
        feather: 0.4,
        invert: false,
        mode: 'add',
      };
    } else if (localManager.mode === 'linear') {
      localManager.draftShape = {
        type: 'linear',
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        feather: 0.35,
        invert: false,
        mode: 'add',
      };
    }
    rebuildMask({ publishUrl: false });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!painting) {
      return;
    }
    const point = pointerToNorm(event);
    if (!point || !dragStart) {
      return;
    }

    if (localManager.mode === 'brush' || localManager.mode === 'erase') {
      localManager.appendBrushPoint(point);
    } else if (localManager.mode === 'radial') {
      const radius = Math.max(0.01, Math.hypot(point.x - dragStart.x, point.y - dragStart.y));
      localManager.draftShape = {
        type: 'radial',
        cx: dragStart.x,
        cy: dragStart.y,
        radiusX: radius,
        radiusY: radius,
        feather: 0.4,
        invert: false,
        mode: 'add',
      };
    } else if (localManager.mode === 'linear') {
      localManager.draftShape = {
        type: 'linear',
        x1: dragStart.x,
        y1: dragStart.y,
        x2: point.x,
        y2: point.y,
        feather: 0.35,
        invert: false,
        mode: 'add',
      };
    }
    rebuildMask({ publishUrl: false });
  };

  const onPointerUp = () => {
    if (!painting) {
      return;
    }
    painting = false;
    if (localManager.draftShape?.type === 'radial') {
      localManager.setRadialMask(localManager.draftShape);
    } else if (localManager.draftShape?.type === 'linear') {
      localManager.setLinearMask(localManager.draftShape);
    }
    localManager.draftShape = null;
    dragStart = null;
    rebuildMask({ publishUrl: true });
  };

  onMount(() => {
    const observer = new ResizeObserver(() => syncCanvasSize());
    if (container) {
      observer.observe(container);
    }
    return () => observer.disconnect();
  });
</script>

<div class="flex size-full flex-col items-center justify-center p-4 md:p-8" bind:this={container}>
  <p class="mb-3 text-center text-xs text-white/70">{$t('editor_local_paint_hint')}</p>
  <div class="relative max-h-full max-w-full" style:width={displayWidth ? `${displayWidth}px` : undefined}>
    <!-- Base photo (always unfiltered) -->
    <img
      bind:this={imgEl}
      draggable="false"
      src={imageSrc}
      alt={$getAltText(toTimelineAsset(asset))}
      class="h-auto max-h-[70dvh] w-auto max-w-full select-none"
      onload={syncCanvasSize}
    />

    <!-- Adjusted photo, clipped to the mask only -->
    {#if showAdjustedPreview && maskDataUrl && activeFilter}
      <img
        draggable="false"
        src={imageSrc}
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full max-h-[70dvh] object-contain select-none"
        style:filter={activeFilter}
        style:mask-image={`url(${maskDataUrl})`}
        style:-webkit-mask-image={`url(${maskDataUrl})`}
        style:mask-mode="luminance"
        style:-webkit-mask-mode="luminance"
        style:mask-size="100% 100%"
        style:-webkit-mask-size="100% 100%"
        style:mask-repeat="no-repeat"
        style:-webkit-mask-repeat="no-repeat"
      />
    {/if}

    <!-- Light pink mask guide + paint hit target -->
    <canvas
      bind:this={overlayCanvas}
      class="absolute inset-0 cursor-crosshair touch-none"
      style:width={displayWidth ? `${displayWidth}px` : '100%'}
      style:height={displayHeight ? `${displayHeight}px` : '100%'}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    ></canvas>
  </div>
</div>
