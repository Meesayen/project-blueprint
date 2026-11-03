<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Canvas, Gradient, IText, Text } from 'fabric';

const props = withDefaults(defineProps<{ width?: number; height?: number }>(), {
  width: 960,
  height: 600,
});

const canvasEl = ref<HTMLCanvasElement | null>(null);
let canvas: Canvas | null = null;

onMounted(() => {
  if (!canvasEl.value) return;

  canvas = new Canvas(canvasEl.value, {
    width: props.width,
    height: props.height,
    backgroundColor: '#fffaf0',
    enableRetinaScaling: true,
  });

  const titleGradient = new Gradient({
    type: 'linear',
    coords: { x1: 0, y1: 0, x2: 240, y2: 0 },
    colorStops: [
      { offset: 0, color: '#b45309' },
      { offset: 0.5, color: '#c2410c' },
      { offset: 1, color: '#7c2d12' },
    ],
  });

  const title = new Text('Blueprint Canvas', {
    left: props.width / 2,
    top: props.height / 2 - 10,
    originX: 'center',
    originY: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'system-ui, sans-serif',
    fill: titleGradient,
  });

  const subtitle = new Text(`${props.width} × ${props.height} · 16:10`, {
    left: props.width / 2,
    top: props.height / 2 + 20,
    originX: 'center',
    originY: 'center',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    fill: '#78716c',
  });

  canvas.add(title, subtitle);
  canvas.renderAll();
});

const addText = () => {
  if (!canvas) return;
  const text = new IText('Text', {
    left: props.width / 2 + (Math.random() - 0.5) * 60,
    top: props.height / 2 + (Math.random() - 0.5) * 60,
    originX: 'center',
    originY: 'center',
    fontSize: 20,
    fontFamily: 'system-ui, sans-serif',
    fill: '#78716c',
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
};

onBeforeUnmount(() => {
  canvas?.dispose();
  canvas = null;
});
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div
      class="w-[960px] max-w-full aspect-[16/10] rounded-xl overflow-hidden border border-orange-200 bg-[#fffaf0] shadow-sm"
    >
      <canvas ref="canvasEl"></canvas>
    </div>
    <div
      class="flex items-center gap-2 rounded-md border border-orange-700 bg-[#c2410c] px-2 py-1.5 text-white shadow-md"
    >
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-sm bg-white font-bold text-[#c2410c] transition-colors hover:bg-orange-50"
        v-tooltip="'Add text'"
        @click="addText"
      >
        T
      </button>
    </div>
  </div>
</template>
