<script setup lang="ts">
import FloorplanCanvas from './components/FloorplanCanvas.vue';
import { TooltipDirectiveTarget } from '@meesayen/pure-tooltip/vue';
</script>

<template>
  <section
    class="min-h-screen bg-[var(--fp-page-bg)] text-[var(--fp-page-text)] transition-colors duration-200 flex items-center justify-center p-8"
  >
    <div class="flex w-full max-w-[960px] flex-col items-center gap-8">
      <header class="flex flex-col items-center gap-3 text-center">
        <h1
          class="font-display text-4xl font-semibold tracking-tight text-[var(--fp-title)] transition-colors sm:text-5xl"
        >
          Blueprint
        </h1>
        <div
          class="flex max-w-4xl flex-col gap-2 text-sm leading-relaxed text-[var(--fp-panel-muted)] transition-colors"
        >
          <p>
            This is a small-scale recreation of one of the tools within
            <a
              href="https://studio.spoak.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-[var(--fp-title)] underline decoration-from-font underline-offset-2 transition-colors hover:opacity-80"
              >Spoak</a
            >
            — arguably one of its most important ones — which I’ve been working on since 2020.
          </p>
          <p>
            What started as a simple mockup tool for designers has gradually evolved into a much
            more powerful platform, offering advanced mockup capabilities (including a sort of “fake
            3D” effect on 2D mockups) as well as full-fledged floorplanning tools.
          </p>
          <p>
            This little demo showcases just a fraction of what
            <a
              href="https://studio.spoak.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-[var(--fp-title)] underline decoration-from-font underline-offset-2 transition-colors hover:opacity-80"
              >Spoak</a
            >’s floorplanning engine is capable of. It’s also a project I’m particularly proud of as
            a developer: something I’ve built from the ground up, evolved over the years, and
            brought to life largely on my own.
          </p>
        </div>
      </header>
      <FloorplanCanvas />
    </div>
  </section>
  <TooltipDirectiveTarget />
</template>
