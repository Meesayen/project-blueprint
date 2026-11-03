export type PaletteId = 'light' | 'espresso';

export type ThemeMode = 'light' | 'dark';

export type FloorplanPalette = {
  id: PaletteId;
  label: string;
  mode: ThemeMode;
  swatch: string;
  canvasBg: string;
  wallFill: string;
  wallStroke: string;
  wallHighlight: string;
  junctionFill: string;
  junctionStroke: string;
  cursorFill: string;
  cursorSnapFill: string;
  cursorStroke: string;
  startFill: string;
  startStroke: string;
  draftFill: string;
  guidelineStroke: string;
  roomFill: string;
  roomStroke: string;
  roomPreviewFill: string;
  textFill: string;
  uiPageBg: string;
  uiPageText: string;
  uiTitle: string;
  uiPanelBg: string;
  uiPanelBorder: string;
  uiPanelText: string;
  uiPanelMuted: string;
  uiActionBtnBg: string;
  uiActionBtnText: string;
  uiActionBtnHoverBg: string;
  uiActionActiveBg: string;
  uiActionActiveText: string;
  uiToggleBg: string;
  uiToggleText: string;
  uiToggleHoverBg: string;
  uiToggleActiveBg: string;
  uiToggleActiveText: string;
};

const light: FloorplanPalette = {
  id: 'light',
  label: 'Light',
  mode: 'light',
  swatch: '#5b3a24',
  canvasBg: '#fffdf9',
  wallFill: '#5b3a24',
  wallStroke: '#5b3a24',
  wallHighlight: '#b45309',
  junctionFill: '#b45309',
  junctionStroke: '#fffaf0',
  cursorFill: '#d97706',
  cursorSnapFill: '#92400e',
  cursorStroke: '#fffaf0',
  startFill: '#fffaf0',
  startStroke: '#b45309',
  draftFill: '#b4530977',
  guidelineStroke: '#b45309',
  roomFill: '#fed7aa',
  roomStroke: '#c2410c',
  roomPreviewFill: 'rgba(254, 215, 170, 0.3)',
  textFill: '#78716c',
  uiPageBg: '#faf7f2',
  uiPageText: '#292524',
  uiTitle: '#9a3412',
  uiPanelBg: '#fffaf0',
  uiPanelBorder: '#fed7aa',
  uiPanelText: '#44403c',
  uiPanelMuted: '#78716c',
  uiActionBtnBg: '#9a3412',
  uiActionBtnText: '#ffffff',
  uiActionBtnHoverBg: '#7c2d12',
  uiActionActiveBg: '#c2410c',
  uiActionActiveText: '#ffffff',
  uiToggleBg: '#ffffff',
  uiToggleText: '#44403c',
  uiToggleHoverBg: '#fff7ed',
  uiToggleActiveBg: '#c2410c',
  uiToggleActiveText: '#ffffff',
};

const espresso: FloorplanPalette = {
  id: 'espresso',
  label: 'Dark',
  mode: 'dark',
  swatch: '#fb923c',
  canvasBg: '#221b16',
  wallFill: '#f0d9c4',
  wallStroke: '#f0d9c4',
  wallHighlight: '#fb923c',
  junctionFill: '#fb923c',
  junctionStroke: '#221b16',
  cursorFill: '#fbbf24',
  cursorSnapFill: '#fdba74',
  cursorStroke: '#221b16',
  startFill: '#221b16',
  startStroke: '#fb923c',
  draftFill: '#fb923c88',
  guidelineStroke: '#fbbf24',
  roomFill: 'rgba(251, 146, 60, 0.14)',
  roomStroke: '#fb923c',
  roomPreviewFill: 'rgba(251, 146, 60, 0.22)',
  textFill: '#cbb6a4',
  uiPageBg: '#120d0a',
  uiPageText: '#f6ece3',
  uiTitle: '#fb923c',
  uiPanelBg: '#1f1510',
  uiPanelBorder: '#3a2418',
  uiPanelText: '#f6ece3',
  uiPanelMuted: '#b9a493',
  uiActionBtnBg: '#9a3412',
  uiActionBtnText: '#f9e4d8',
  uiActionBtnHoverBg: '#c2410c',
  uiActionActiveBg: '#fb923c',
  uiActionActiveText: '#17110d',
  uiToggleBg: '#2a1b13',
  uiToggleText: '#f6ece3',
  uiToggleHoverBg: '#3a2418',
  uiToggleActiveBg: '#fb923c',
  uiToggleActiveText: '#17110d',
};

export const FLOORPLAN_PALETTES: Record<PaletteId, FloorplanPalette> = {
  light,
  espresso,
};

export const PALETTE_ORDER: PaletteId[] = ['light', 'espresso'];

export const DEFAULT_PALETTE_ID: PaletteId = 'light';

let active: FloorplanPalette = FLOORPLAN_PALETTES[DEFAULT_PALETTE_ID];

export function getActivePalette(): FloorplanPalette {
  return active;
}

export function setActivePalette(id: PaletteId) {
  active = FLOORPLAN_PALETTES[id];
}

export function applyThemeVars(palette: FloorplanPalette) {
  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--fp-page-bg': palette.uiPageBg,
    '--fp-page-text': palette.uiPageText,
    '--fp-title': palette.uiTitle,
    '--fp-panel-bg': palette.uiPanelBg,
    '--fp-panel-border': palette.uiPanelBorder,
    '--fp-panel-text': palette.uiPanelText,
    '--fp-panel-muted': palette.uiPanelMuted,
    '--fp-action-btn-bg': palette.uiActionBtnBg,
    '--fp-action-btn-text': palette.uiActionBtnText,
    '--fp-action-btn-hover-bg': palette.uiActionBtnHoverBg,
    '--fp-action-active-bg': palette.uiActionActiveBg,
    '--fp-action-active-text': palette.uiActionActiveText,
    '--fp-toggle-bg': palette.uiToggleBg,
    '--fp-toggle-text': palette.uiToggleText,
    '--fp-toggle-hover-bg': palette.uiToggleHoverBg,
    '--fp-toggle-active-bg': palette.uiToggleActiveBg,
    '--fp-toggle-active-text': palette.uiToggleActiveText,
    '--fp-canvas-bg': palette.canvasBg,
  };
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = palette.mode;
}
