const CMS_PER_INCH = 2.54;

export const MINOR_LINE_ALPHA = 0.06;
export const MAJOR_ALPHA_MINORS_ON = 0.155;
export const MAJOR_ALPHA_MINORS_OFF = 0.085;
export const MAJOR_STROKE_SCALE = 1.15;
export const MAJOR_LINE_LIMIT = 900;
export const MINOR_LINE_LIMIT = 450;

const MAJOR_FADE_START_PX = 2;
const MINOR_ENTER_PX = 2;
const MINOR_EXIT_PX = 1.6;

type Rgb = { r: number; g: number; b: number };

type GridLevel = {
  majorCm: number;
  minorCm?: number;
  minMajorStepPx: number;
  minMinorStepPx?: number;
};

const FOOT_LEVELS: GridLevel[] = [
  {
    majorCm: 10 * 12 * CMS_PER_INCH,
    minorCm: 12 * CMS_PER_INCH,
    minMajorStepPx: 16,
    minMinorStepPx: 10,
  },
  {
    majorCm: 12 * CMS_PER_INCH,
    minorCm: CMS_PER_INCH,
    minMajorStepPx: 20,
    minMinorStepPx: 10,
  },
  {
    majorCm: CMS_PER_INCH,
    minorCm: CMS_PER_INCH / 16,
    minMajorStepPx: 24,
    minMinorStepPx: 14,
  },
];

const INCH_LEVELS: GridLevel[] = [
  {
    majorCm: 10 * 12 * CMS_PER_INCH,
    minorCm: 12 * CMS_PER_INCH,
    minMajorStepPx: 16,
    minMinorStepPx: 10,
  },
  {
    majorCm: 12 * CMS_PER_INCH,
    minorCm: CMS_PER_INCH,
    minMajorStepPx: 20,
    minMinorStepPx: 10,
  },
  {
    majorCm: CMS_PER_INCH,
    minorCm: CMS_PER_INCH / 16,
    minMajorStepPx: 16,
    minMinorStepPx: 10,
  },
];

const CM_LEVELS: GridLevel[] = [
  { majorCm: 1000, minorCm: 100, minMajorStepPx: 12, minMinorStepPx: 8 },
  { majorCm: 100, minorCm: 10, minMajorStepPx: 30, minMinorStepPx: 10 },
  { majorCm: 10, minorCm: 1, minMajorStepPx: 22, minMinorStepPx: 12 },
  { majorCm: 1, minorCm: 0.1, minMajorStepPx: 24, minMinorStepPx: 10 },
  { majorCm: 0.1, minorCm: 0.05, minMajorStepPx: 32, minMinorStepPx: 22 },
];

function expandHex(hex: string) {
  return hex.length === 3
    ? hex
        .split('')
        .map((c) => c + c)
        .join('')
    : hex;
}

function parseHex(backgroundColor: string | undefined): Rgb {
  const hex = expandHex((backgroundColor || '#faf7f2').replace('#', ''));
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0,
  };
}

// Standard sRGB luminance: dark ink on bright surfaces, light ink on dark ones.
export function pickGridInk(backgroundColor: string | undefined): Rgb {
  const { r, g, b } = parseHex(backgroundColor);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

export function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function computeGridMajorAlpha(minorFactor: number) {
  const t = Math.max(0, Math.min(1, minorFactor));
  return MAJOR_ALPHA_MINORS_OFF + (MAJOR_ALPHA_MINORS_ON - MAJOR_ALPHA_MINORS_OFF) * t;
}

export function rgbaString(rgb: Rgb, alpha: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function levelsForUnit(unit: string): GridLevel[] {
  if (unit === 'cm') return CM_LEVELS;
  if (unit === 'inch') return INCH_LEVELS;
  return FOOT_LEVELS;
}

function selectLevelIndex(levels: GridLevel[], pxPerCm: number, zoom: number) {
  let chosen = 0;
  for (let index = 0; index < levels.length; index++) {
    const level = levels[index];
    if (level.majorCm * pxPerCm * zoom < level.minMajorStepPx) break;
    chosen = index;
  }
  return chosen;
}

function stepFitsViewport(
  step: number,
  zoom: number,
  minStepPx: number,
  lineLimit: number,
  spanX: number,
  spanY: number,
) {
  if (!step || !Number.isFinite(step)) return false;
  if (step * zoom < minStepPx) return false;
  return spanX / step <= lineLimit && spanY / step <= lineLimit;
}

function fadeFactor(currentPx: number, startPx: number, fullPx: number) {
  const range = fullPx - startPx;
  if (range <= 0) return 1;
  return clamp((currentPx - startPx) / range, 0, 1);
}

export function gridLevelsForUnit(unit: string) {
  return levelsForUnit(unit);
}

type GridContext = {
  unit: string;
  pxPerCm: number;
  zoom: number;
};

type ViewportBounds = {
  tl: { x: number; y: number };
  br: { x: number; y: number };
};

export type GridSteps = {
  majorStep: number;
  majorVisibilityFactor: number;
  minorStepPresent: number | null;
  minorStepVisible: number | null;
  minorVisibilityFactor: number;
  snapStep: number;
};

export type GridViewport = {
  context: GridContext;
  bounds: ViewportBounds;
  minorWasVisible?: boolean;
};

export function chooseGridSteps({
  context,
  bounds,
  minorWasVisible = false,
}: GridViewport): GridSteps | null {
  const { unit, pxPerCm, zoom } = context;
  if (!Number.isFinite(pxPerCm) || pxPerCm <= 0) return null;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const levels = levelsForUnit(unit);
  const level = levels[selectLevelIndex(levels, pxPerCm, zoom)];

  const majorStep = level.majorCm * pxPerCm;
  if (!majorStep || !Number.isFinite(majorStep)) return null;

  const overscan = majorStep * 2;
  const spanX = bounds.br.x - bounds.tl.x + overscan * 2;
  const spanY = bounds.br.y - bounds.tl.y + overscan * 2;

  if (!stepFitsViewport(majorStep, zoom, MAJOR_FADE_START_PX, MAJOR_LINE_LIMIT, spanX, spanY)) {
    return null;
  }

  const majorVisibilityFactor = fadeFactor(
    majorStep * zoom,
    MAJOR_FADE_START_PX,
    level.minMajorStepPx,
  );

  const minorStep = level.minorCm ? level.minorCm * pxPerCm : null;
  const minorThresholdPx = minorWasVisible ? MINOR_EXIT_PX : MINOR_ENTER_PX;
  const minorVisible =
    minorStep != null &&
    stepFitsViewport(minorStep, zoom, minorThresholdPx, MINOR_LINE_LIMIT, spanX, spanY);

  let minorVisibilityFactor = 0;
  if (minorStep) {
    minorVisibilityFactor = smoothstep(
      fadeFactor(minorStep * zoom, MINOR_EXIT_PX, level.minMinorStepPx ?? 10),
    );
  }

  return {
    majorStep,
    majorVisibilityFactor,
    minorStepPresent: minorStep,
    minorStepVisible: minorVisible ? minorStep : null,
    minorVisibilityFactor,
    snapStep: minorStep ?? majorStep,
  };
}

export function getGridSnapStepPx({ pxPerCm, zoom }: { pxPerCm: number; zoom: number }) {
  if (!Number.isFinite(pxPerCm) || pxPerCm <= 0) return null;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const level = CM_LEVELS[selectLevelIndex(CM_LEVELS, pxPerCm, zoom)];
  const majorStep = level.majorCm * pxPerCm;
  if (!majorStep || !Number.isFinite(majorStep)) return null;

  const minorStep = level.minorCm ? level.minorCm * pxPerCm : null;
  if (minorStep && Number.isFinite(minorStep) && minorStep > 0) return minorStep;
  return majorStep;
}
