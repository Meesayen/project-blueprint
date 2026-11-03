<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Canvas, IText, Point } from 'fabric';
import { GridOverlay } from '../lib/GridOverlay';
import { setupDrawWalls } from '../lib/floorplan/drawWalls';
import { FpWall } from '../lib/floorplan/wall';
import { Vec2 } from '../lib/vectors';
import { FpRoom } from '../lib/floorplan/room';
import { FpJunctionHandle } from '../lib/floorplan/junction';
import { buildRooms, buildJunctions } from '../lib/floorplan/roomBuilder';
import { createInitialWalls } from '../lib/floorplan/initialWalls';
import {
  DEFAULT_PALETTE_ID,
  FLOORPLAN_PALETTES,
  PALETTE_ORDER,
  applyThemeVars,
  getActivePalette,
  setActivePalette,
  type PaletteId,
} from '../lib/floorplan/palette';
import pencilRaw from '../assets/pencil.svg?raw';

const canvasEl = ref<HTMLCanvasElement | null>(null);
let canvas: any = null;
let grid: GridOverlay | null = null;

const mode = ref<'select' | 'wall'>('select');
const paletteId = ref<PaletteId>(DEFAULT_PALETTE_ID);

const pencilSvg = pencilRaw.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');

const junctionDots: any[] = [];
const junctionInfos: { dot: any; v: { x: number; y: number }; walls: any[] }[] = [];
let hoverTarget: any = null;

let wallController: {
  enter: () => void;
  exit: () => void;
  drawOverlay?: (ctx: any) => void;
  applyPalette?: () => void;
  reset?: () => void;
} | null = null;
let currentController: { exit: () => void } | null = null;

function toggleWallMode() {
  mode.value = mode.value === 'wall' ? 'select' : 'wall';
}

function applyPalette(id: PaletteId) {
  setActivePalette(id);
  const palette = FLOORPLAN_PALETTES[id];
  applyThemeVars(palette);
  if (!canvas) return;
  canvas.backgroundColor = palette.canvasBg;
  canvas.spkSettings = { backgroundColor: palette.canvasBg };
  canvas.getObjects().forEach((obj: any) => {
    if (obj instanceof FpWall) {
      obj.set({ fill: palette.wallFill, stroke: palette.wallStroke });
    } else if (obj instanceof FpRoom) {
      obj.set({ fill: palette.roomFill, stroke: palette.roomStroke });
    } else if (obj instanceof IText) {
      obj.set({ fill: palette.textFill });
    }
  });
  junctionDots.forEach((dot: any) => {
    dot.set({ fill: palette.junctionFill, stroke: palette.junctionStroke });
  });
  wallController?.applyPalette?.();
  canvas.requestRenderAll();
}

function rebuildRooms() {
  if (!canvas) return;
  canvas.getObjects().forEach((obj: any) => {
    if (obj instanceof FpRoom) canvas.remove(obj);
  });
  const walls = canvas.getObjects().filter((obj: any) => obj instanceof FpWall);
  const rooms = buildRooms(walls);
  rooms.forEach((room) => canvas.add(room));
  walls.forEach((w: any) => canvas.bringObjectToFront?.(w));
  rebuildJunctions();
  walls.forEach((w: any) => {
    w.unfreezeQuadsForDrag?.();
    w.unfreezeRoomSidesForDrag?.();
    w._quadsDirty = true;
    if (typeof w.rebuildQuads === 'function') w.rebuildQuads();
  });
  canvas.requestRenderAll();
}

let junctionMapDirty = false;

function getConnectedWalls(wall: any): any[] {
  const map = (canvas as any)?.fpWallJunctions as Map<string, Set<any>> | undefined;
  if (!map) return [];
  const out = new Set<any>();
  const [v1, v2] = wall.vectors;
  for (const vec of [v1, v2]) {
    const set = map.get(vec.id);
    if (!set) continue;
    for (const j of set) {
      if (j.wall !== wall) out.add(j.wall);
    }
  }
  return [...out];
}

function refreshJunctionMapOnly() {
  if (!canvas) return;
  const walls = canvas.getObjects().filter((obj: any) => obj instanceof FpWall);
  const { wallJunctions, junctionIdVectorMap } = buildJunctions(walls);
  (canvas as any).fpWallJunctions = wallJunctions;
  (canvas as any).fpGrid = { pxPerCm: grid?.pxPerCm ?? 1 };
  // reposition existing junction dots so corners follow the wall during drag
  const byId = new Map<string, { v: Vec2; set: Set<any> }>();
  for (const [id, set] of wallJunctions.entries()) {
    if (set.size < 2) continue;
    const v = junctionIdVectorMap.get(id);
    if (v) byId.set(id, { v, set });
  }
  junctionDots.forEach((dot: any) => {
    const id = dot.vector?.id;
    const info = id ? byId.get(id) : undefined;
    if (info) {
      dot.vector = new Vec2(info.v.x, info.v.y);
      dot.setPositionByOrigin(new Point(info.v.x, info.v.y), 'center', 'center');
      dot.setCoords();
    }
  });
}

function scheduleJunctionMapRefresh() {
  if (!canvas) return;
  junctionMapDirty = true;
}

function rebuildJunctions() {
  if (!canvas) return;
  junctionDots.forEach((d) => canvas.remove(d));
  junctionDots.length = 0;
  junctionInfos.length = 0;
  const walls = canvas.getObjects().filter((obj: any) => obj instanceof FpWall);
  const { wallJunctions, junctionIdVectorMap } = buildJunctions(walls);
  (canvas as any).fpWallJunctions = wallJunctions;
  (canvas as any).fpGrid = { pxPerCm: grid?.pxPerCm ?? 1 };
  for (const [id, set] of wallJunctions.entries()) {
    if (set.size < 2) continue;
    const v = junctionIdVectorMap.get(id);
    if (!v) continue;
    const junctions = [...set].map((j: any) => ({ wall: j.wall, node: j.node }));
    const dot = new FpJunctionHandle({
      left: v.x,
      top: v.y,
    });
    dot._junctions = junctions;
    dot.vector = new Vec2(v.x, v.y);
    dot.on('modified', () => {
      requestAnimationFrame(() => rebuildRooms());
    });
    canvas.add(dot);
    junctionDots.push(dot);
  }
  junctionMapDirty = false;
}

// Gesture state
let isSpaceHeld = false;
let isPanning = false;
let lastPan = { x: 0, y: 0 };
const pointers: PointerEvent[] = [];
let prevPointerData = { distance: 0, x: null as number | null, y: null as number | null };

function onKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Backspace' || e.key === 'Delete') && mode.value === 'select') {
    const targets = (canvas?.getActiveObjects?.() ?? []).filter((o: any) => o instanceof FpWall);
    if (targets.length) {
      e.preventDefault();
      canvas.discardActiveObject();
      targets.forEach((w: any) => canvas.remove(w));
      hoverTarget = null;
      rebuildRooms();
    }
    return;
  }
  if (e.key === 'Escape' && mode.value === 'wall') {
    mode.value = 'select';
    return;
  }
  if (e.code === 'Space') {
    if (isSpaceHeld) return;
    isSpaceHeld = true;
    setPanCursor('grab');
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpaceHeld = false;
    if (!isPanning) setPanCursor('');
  }
}

function setPanCursor(cursor: '' | 'grab' | 'grabbing') {
  const el = canvas?.upperCanvasEl as HTMLElement | undefined;
  if (el) el.style.cursor = cursor;
}

function startManualPan(e: MouseEvent) {
  if (!isSpaceHeld) return;
  e.preventDefault();
  e.stopPropagation();
  isPanning = true;
  setPanCursor('grabbing');
  lastPan = { x: e.clientX, y: e.clientY };
}

function performManualPan(e: MouseEvent) {
  if (!isPanning || !canvas) return;
  const vpt = canvas.viewportTransform;
  vpt[4] += e.clientX - lastPan.x;
  vpt[5] += e.clientY - lastPan.y;
  canvas.setViewportTransform(vpt);
  canvas.requestRenderAll();
  lastPan = { x: e.clientX, y: e.clientY };
}

function endManualPan() {
  if (!isPanning) return;
  isPanning = false;
  setPanCursor(isSpaceHeld ? 'grab' : '');
}

function onVisibilityChange() {
  if (document.hidden) resetSpaceState();
}

function onWindowBlur() {
  resetSpaceState();
}

function resetSpaceState() {
  isSpaceHeld = false;
  isPanning = false;
  setPanCursor('');
}

function registerPointer(e: PointerEvent) {
  if (e.button !== 0) return;
  if (isSpaceHeld) return;
  pointers.push(e);
  if (pointers.length >= 2) {
    canvas.selection = false;
  }
}

function handlePointerMove(e: PointerEvent) {
  for (let i = 0; i < pointers.length; i++) {
    if (pointers[i].pointerId === e.pointerId) {
      pointers[i] = e;
      break;
    }
  }

  if (pointers.length === 2) {
    const [p1, p2] = pointers;
    if (!p1 || !p2) return;
    const midX = (p1.clientX + p2.clientX) / 2;
    const midY = (p1.clientY + p2.clientY) / 2;
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!prevPointerData.distance) {
      prevPointerData = { distance: dist, x: midX, y: midY };
      return;
    }

    if (prevPointerData.x !== null && prevPointerData.y !== null) {
      const panDx = midX - prevPointerData.x;
      const panDy = midY - prevPointerData.y;
      if (panDx || panDy) {
        canvas.relativePan(new Point(panDx, panDy));
      }
    }

    if (dist > 0 && prevPointerData.distance > 0) {
      const factor = dist / prevPointerData.distance;
      const rect = (canvas.upperCanvasEl as HTMLElement).getBoundingClientRect();
      const newZoom = canvas.getZoom() * factor;
      canvas.zoomToPoint(new Point(midX - rect.left, midY - rect.top), newZoom);
    }

    prevPointerData = { distance: dist, x: midX, y: midY };
    canvas.requestRenderAll();
    return;
  }
}

function unregisterPointer(e: PointerEvent) {
  for (let i = 0; i < pointers.length; i++) {
    if (pointers[i].pointerId === e.pointerId) {
      pointers.splice(i, 1);
      break;
    }
  }
  prevPointerData = { distance: 0, x: null, y: null };
  if (pointers.length < 2) {
    canvas.selection = true;
  }
}

function onWheel(o: any) {
  const e = o.e as WheelEvent;
  if (e.ctrlKey) {
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), canvas.getZoom() * factor);
    e.preventDefault();
    e.stopPropagation();
    canvas.requestRenderAll();
    return;
  }
  const multiplier = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
  const delta = new Point(-e.deltaX * multiplier, -e.deltaY * multiplier);
  canvas.relativePan(delta);
  canvas.requestRenderAll();
  e.preventDefault();
}

onMounted(() => {
  if (!canvasEl.value) return;

  canvas = new Canvas(canvasEl.value, {
    width: 960,
    height: 600,
    backgroundColor: getActivePalette().canvasBg,
    enableRetinaScaling: true,
  });

  canvas.spkSettings = { backgroundColor: getActivePalette().canvasBg };

  grid = new GridOverlay({ unit: 'cm', pxPerCm: 1 });
  canvas.add(grid);
  grid.visible = true;

  wallController = setupDrawWalls(canvas, rebuildRooms);

  createInitialWalls().forEach((wall) => canvas.add(wall));
  rebuildRooms();

  // Gestures
  const upper = canvas.upperCanvasEl as HTMLElement;
  const panSurface = upper;

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  upper.addEventListener('mousedown', startManualPan, true);
  window.addEventListener('mousemove', performManualPan);
  window.addEventListener('mouseup', endManualPan);

  panSurface.addEventListener('pointerdown', registerPointer);
  panSurface.addEventListener('pointermove', handlePointerMove);
  panSurface.addEventListener('pointerup', unregisterPointer);
  panSurface.addEventListener('pointerout', unregisterPointer);
  panSurface.addEventListener('pointerleave', unregisterPointer);
  panSurface.addEventListener('pointercancel', unregisterPointer);

  canvas.on('mouse:wheel', onWheel);

  // Highlight on hover (v4-style, canvas level)
  canvas.on('mouse:over', (e: any) => {
    if (e.target instanceof FpWall) {
      hoverTarget = e.target;
    } else {
      hoverTarget = null;
    }
    canvas.requestRenderAll();
  });
  canvas.on('mouse:out', (e: any) => {
    if (hoverTarget === e.target) {
      hoverTarget = null;
      canvas.requestRenderAll();
    }
  });
  canvas.on('mouse:down:before', () => {
    hoverTarget = null;
  });
  canvas.on('object:moving', (e: any) => {
    const target = e.target;
    if (target instanceof FpWall) {
      target.freezeRoomSidesForDrag?.();
      const walls = [target, ...getConnectedWalls(target)];
      walls.forEach((w: any) => w.freezeRoomSidesForDrag?.());
      scheduleJunctionMapRefresh();
    } else if (target instanceof FpJunctionHandle) {
      target._junctions?.forEach((j: any) => {
        const w = j.wall;
        w.freezeRoomSidesForDrag?.();
        getConnectedWalls(w).forEach((cw: any) => cw.freezeRoomSidesForDrag?.());
      });
      scheduleJunctionMapRefresh();
    }
  });

  canvas.on('object:modified', (e: any) => {
    const target = e.target;
    if (target instanceof FpWall) {
      rebuildRooms();
    }
  });

  // Wrap renderCanvas to draw highlight (and coalesce junction map refresh)
  const originalRenderCanvas = canvas.renderCanvas.bind(canvas);
  canvas.renderCanvas = (ctx: CanvasRenderingContext2D, objects: any[]) => {
    if (junctionMapDirty) {
      refreshJunctionMapOnly();
      junctionMapDirty = false;
    }
    originalRenderCanvas(ctx, objects);
    const active = canvas.getActiveObject?.();
    const target = hoverTarget ?? (active instanceof FpWall ? active : null);
    if (target && target.visible) {
      target.renderHighlight(ctx);
    }
    if (mode.value === 'wall' && wallController?.drawOverlay) {
      wallController.drawOverlay(ctx);
    }
  };

  canvas.requestRenderAll();
});

watch(
  paletteId,
  (id) => {
    applyPalette(id);
  },
  { immediate: true },
);

watch(mode, (newMode) => {
  if (currentController) {
    currentController.exit();
    currentController = null;
  }
  if (newMode === 'wall' && wallController) {
    canvas.selection = false;
    canvas.skipTargetFind = true;
    wallController.enter();
    currentController = wallController;
  } else {
    canvas.selection = true;
    canvas.skipTargetFind = false;
  }
});

onBeforeUnmount(() => {
  if (!canvas) return;
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', onWindowBlur);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  const upper = canvas.upperCanvasEl as HTMLElement;
  upper.removeEventListener('mousedown', startManualPan, true);
  window.removeEventListener('mousemove', performManualPan);
  window.removeEventListener('mouseup', endManualPan);
  upper.removeEventListener('pointerdown', registerPointer);
  upper.removeEventListener('pointermove', handlePointerMove);
  upper.removeEventListener('pointerup', unregisterPointer);
  upper.removeEventListener('pointerout', unregisterPointer);
  upper.removeEventListener('pointerleave', unregisterPointer);
  upper.removeEventListener('pointercancel', unregisterPointer);
  canvas.off('mouse:wheel', onWheel);
  if (currentController) currentController.exit();
  grid = null;
  canvas.dispose();
  canvas = null;
});
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div
      class="flex w-[960px] max-w-full items-center gap-2 rounded-md border border-[var(--fp-panel-border)] bg-[var(--fp-panel-bg)] px-2 py-1.5 shadow-sm transition-colors duration-200"
    >
      <span class="text-xs font-medium uppercase tracking-wide text-[var(--fp-panel-muted)]"
        >Palette</span
      >
      <button
        v-for="id in PALETTE_ORDER"
        :key="id"
        type="button"
        class="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-medium transition-colors"
        :class="
          paletteId === id
            ? 'bg-[var(--fp-toggle-active-bg)] text-[var(--fp-toggle-active-text)]'
            : 'bg-[var(--fp-toggle-bg)] text-[var(--fp-toggle-text)] hover:bg-[var(--fp-toggle-hover-bg)]'
        "
        :aria-pressed="paletteId === id"
        v-tooltip="`${FLOORPLAN_PALETTES[id].label} theme`"
        @click="paletteId = id"
      >
        <span
          class="h-3 w-3 rounded-full border border-[var(--fp-panel-border)]"
          :style="{
            background:
              FLOORPLAN_PALETTES[id].mode === 'light'
                ? FLOORPLAN_PALETTES[id].swatch
                : `linear-gradient(135deg, ${FLOORPLAN_PALETTES[id].canvasBg} 45%, ${FLOORPLAN_PALETTES[id].uiToggleActiveBg} 55%)`,
          }"
        ></span>
        {{ FLOORPLAN_PALETTES[id].label }}
      </button>
    </div>
    <div class="relative w-[960px] max-w-full">
      <div
        class="aspect-[16/10] overflow-hidden rounded-md border border-[var(--fp-panel-border)] bg-[var(--fp-canvas-bg)] shadow-sm transition-colors duration-200"
      >
        <canvas ref="canvasEl"></canvas>
      </div>
      <div class="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          :key="mode"
          type="button"
          class="flex h-8 items-center justify-center rounded-sm px-3 text-sm font-medium shadow-md transition-colors"
          :class="
            mode === 'wall'
              ? 'bg-[var(--fp-action-active-bg)] text-[var(--fp-action-active-text)]'
              : 'bg-[var(--fp-action-btn-bg)] text-[var(--fp-action-btn-text)] hover:bg-[var(--fp-action-btn-hover-bg)]'
          "
          :aria-pressed="mode === 'wall'"
          :aria-label="mode === 'wall' ? 'Cancel drawing' : 'Draw walls'"
          v-tooltip="{
            text: mode === 'wall' ? 'Cancel drawing (Esc)' : 'Draw walls',
            position: 'left',
          }"
          @click="toggleWallMode"
        >
          <span v-if="mode === 'wall'">Cancel</span>
          <span
            v-else
            class="pencil-icon block h-4 w-4 text-current"
            v-html="pencilSvg"
            aria-hidden="true"
          ></span>
        </button>
      </div>
    </div>
  </div>
</template>
