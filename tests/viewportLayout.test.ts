import { describe, expect, it } from 'vitest';
import { logicalWidthForViewport, mobileWorldZoom } from '../src/game/config/ViewportLayout';

describe('mobile viewport layout', () => {
  it('keeps the desktop design width for mouse layouts', () => {
    expect(logicalWidthForViewport({ width: 1920, height: 1080, coarsePointer: false })).toBe(1280);
  });

  it('uses a phone landscape aspect in either orientation and caps ultrawide screens', () => {
    expect(logicalWidthForViewport({ width: 750, height: 342, coarsePointer: true })).toBe(1579);
    expect(logicalWidthForViewport({ width: 342, height: 750, coarsePointer: true })).toBe(1579);
    expect(logicalWidthForViewport({ width: 1000, height: 300, coarsePointer: true })).toBe(2048);
    expect(logicalWidthForViewport({ width: 1280, height: 490, coarsePointer: true })).toBe(1881);
  });

  it('never narrows the authored 16:9 layout and only zooms the mobile world', () => {
    expect(logicalWidthForViewport({ width: 667, height: 375, coarsePointer: true })).toBe(1281);
    expect(mobileWorldZoom(true)).toBe(1.35);
    expect(mobileWorldZoom(false)).toBe(1);
  });
});
