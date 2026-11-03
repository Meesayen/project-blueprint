import { FabricObject } from 'fabric';
import {
  pickGridInk,
  rgbaString,
  computeGridMajorAlpha,
  MINOR_LINE_ALPHA,
  MAJOR_STROKE_SCALE,
  MAJOR_LINE_LIMIT,
  MINOR_LINE_LIMIT,
  chooseGridSteps,
} from './grid';

type GridArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type GridPaint = {
  area: GridArea;
  step: number;
  zoom: number;
  ink: string;
  width: number;
  lineLimit: number;
  majorStep?: number;
};

const MIN_LINE_GAP_PX = 2;

export class GridOverlay extends FabricObject {
  unit = 'cm';
  pxPerCm = 1;
  private _minorWasVisible = false;

  constructor(options: Partial<GridOverlay> = {}) {
    super({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: false,
      visible: true,
      ...options,
    });
  }

  override shouldCache() {
    return false;
  }

  override isOnScreen() {
    return true;
  }

  override isPartiallyOnScreen() {
    return true;
  }

  override containsPoint() {
    return false;
  }

  override render(ctx: CanvasRenderingContext2D) {
    const canvas = (this as { canvas?: any }).canvas as {
      calcViewportBoundaries: () => {
        tl: { x: number; y: number };
        br: { x: number; y: number };
      };
      getZoom: () => number;
      spkSettings?: { backgroundColor?: string };
    } | null;
    if (!canvas || !this.visible) return;

    const zoom = canvas.getZoom() || 1;
    const { tl, br } = canvas.calcViewportBoundaries();
    const ink = pickGridInk(canvas.spkSettings?.backgroundColor || '#faf7f2');

    const steps = chooseGridSteps({
      context: { unit: this.unit, pxPerCm: this.pxPerCm, zoom },
      bounds: { tl, br },
      minorWasVisible: this._minorWasVisible,
    });
    if (!steps) return;

    this._minorWasVisible = steps.minorStepVisible != null;

    const margin = steps.majorStep * 2;
    const area: GridArea = {
      left: tl.x - margin,
      top: tl.y - margin,
      right: br.x + margin,
      bottom: br.y + margin,
    };

    const minorFactor = Math.max(0, Math.min(1, steps.minorVisibilityFactor));

    ctx.save();

    if (steps.minorStepVisible) {
      paintLines(ctx, {
        area,
        step: steps.minorStepVisible,
        zoom,
        ink: rgbaString(ink, MINOR_LINE_ALPHA * (0.1 + minorFactor * 0.9)),
        width: 1 / zoom,
        lineLimit: MINOR_LINE_LIMIT,
        majorStep: steps.majorStep,
      });
    }

    paintLines(ctx, {
      area,
      step: steps.majorStep,
      zoom,
      ink: rgbaString(ink, computeGridMajorAlpha(steps.minorVisibilityFactor)),
      width: MAJOR_STROKE_SCALE / zoom,
      lineLimit: MAJOR_LINE_LIMIT,
    });

    ctx.restore();
  }
}

function isMajorMultiple(value: number, majorStep: number) {
  const ratio = value / majorStep;
  return Math.abs(ratio - Math.round(ratio)) < 0.000001;
}

function paintLines(
  ctx: CanvasRenderingContext2D,
  { area, step, zoom, ink, width, lineLimit, majorStep }: GridPaint,
) {
  if (!Number.isFinite(step) || step <= 0) return;
  if (step * zoom < MIN_LINE_GAP_PX) return;
  if ((area.right - area.left) / step > lineLimit) return;
  if ((area.bottom - area.top) / step > lineLimit) return;

  const skip = (value: number) =>
    majorStep != null && step !== majorStep && isMajorMultiple(value, majorStep);

  const firstX = Math.floor(area.left / step) * step;
  const firstY = Math.floor(area.top / step) * step;

  ctx.beginPath();
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;

  for (let x = firstX; x <= area.right + step; x += step) {
    if (skip(x)) continue;
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
  }

  for (let y = firstY; y <= area.bottom + step; y += step) {
    if (skip(y)) continue;
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
  }

  ctx.stroke();
}
