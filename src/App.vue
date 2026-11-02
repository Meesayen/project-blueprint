<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Canvas, Gradient, Text } from 'fabric';

const canvasEl = ref<HTMLCanvasElement | null>(null);
let canvas: Canvas | null = null;

onMounted(() => {
  if (!canvasEl.value) return;

  canvas = new Canvas(canvasEl.value, {
    width: 960,
    height: 600,
    backgroundColor: '#fffaf0',
    enableRetinaScaling: true,
    selection: false,
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
    left: 480,
    top: 290,
    originX: 'center',
    originY: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'system-ui, sans-serif',
    fill: titleGradient,
  });

  const subtitle = new Text('960 × 600 · 16:10', {
    left: 480,
    top: 320,
    originX: 'center',
    originY: 'center',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    fill: '#78716c',
  });

  canvas.add(title, subtitle);
  canvas.renderAll();
});

onBeforeUnmount(() => {
  canvas?.dispose();
  canvas = null;
});
</script>

<template>
  <section class="min-h-screen bg-[#faf7f2] text-stone-800 flex items-center justify-center p-8">
    <div
      class="w-[960px] max-w-full aspect-[16/10] rounded-xl overflow-hidden border border-orange-200 bg-[#fffaf0] shadow-sm"
    >
      <canvas ref="canvasEl"></canvas>
    </div>
  </section>
</template>
