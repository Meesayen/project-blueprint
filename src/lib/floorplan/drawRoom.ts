import { Polygon } from 'fabric';
import { FpRoom } from './room';
import { getActivePalette } from './palette';

export function setupDrawRoom(canvas: any) {
  let points: { x: number; y: number }[] = [];
  let preview: any = null;

  function snap(p: { x: number; y: number }) {
    const grid = 20;
    return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
  }

  function updatePreview() {
    if (preview) canvas.remove(preview);
    if (points.length === 0) return;
    const pts = [...points];
    const palette = getActivePalette();
    preview = new Polygon(pts, {
      fill: palette.roomPreviewFill,
      stroke: palette.roomStroke,
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
    });
    canvas.add(preview);
    canvas.requestRenderAll();
  }

  function applyPalette() {
    if (preview && points.length) updatePreview();
    canvas.requestRenderAll();
  }

  function onMouseDown(o: any) {
    const p = snap(canvas.getScenePoint(o.e));
    // close if near first point
    if (points.length > 2) {
      const first = points[0];
      if (Math.hypot(p.x - first.x, p.y - first.y) < 20) {
        const room = new FpRoom(points);
        canvas.add(room);
        points = [];
        if (preview) {
          canvas.remove(preview);
          preview = null;
        }
        canvas.requestRenderAll();
        return;
      }
    }
    points.push(p);
    updatePreview();
  }

  function onDblClick() {
    if (points.length < 3) return;
    const room = new FpRoom(points);
    canvas.add(room);
    points = [];
    if (preview) {
      canvas.remove(preview);
      preview = null;
    }
    canvas.requestRenderAll();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      points = [];
      if (preview) canvas.remove(preview);
      preview = null;
      canvas.requestRenderAll();
    }
  }

  return {
    enter() {
      canvas.defaultCursor = 'crosshair';
      canvas.on('mouse:down', onMouseDown);
      canvas.on('mouse:dblclick', onDblClick);
      window.addEventListener('keydown', onKeyDown);
    },
    exit() {
      canvas.defaultCursor = 'default';
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:dblclick', onDblClick);
      window.removeEventListener('keydown', onKeyDown);
      points = [];
      if (preview) canvas.remove(preview);
      preview = null;
      canvas.requestRenderAll();
    },
    applyPalette,
  };
}
