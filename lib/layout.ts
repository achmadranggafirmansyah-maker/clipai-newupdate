import { StyleConfig } from './types';

// Kanvas output portrait, di-cap di 720p (720x1280) sesuai aturan produk.
export const OUT_W = 720;
export const OUT_H = 1280;
// Radius blur maksimum (px, dipakai ffmpeg boxblur) saat blurAmount = 100.
export const MAX_BLUR_RADIUS = 30;

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Hitung ukuran & posisi layer overlay (video utama, rasio 16:9) di atas
 * kanvas 9:16, berdasarkan style config dari user.
 *
 * PENTING: fungsi ini dipakai baik oleh render ffmpeg (lib/ffmpeg.ts) maupun
 * preview di UI (components/Wizard.tsx). Jangan duplikasi rumusnya di tempat
 * lain — supaya apa yang dilihat user di preview selalu match dengan hasil
 * render video asli.
 */
export function computeOverlayLayout(styleConfig: StyleConfig) {
  const zoomFrac = clamp(styleConfig.zoom, 50, 150) / 100;
  const posX = clamp(styleConfig.posX, -50, 50);
  const posY = clamp(styleConfig.posY, -50, 50);
  const blurAmount = clamp(styleConfig.blurAmount, 0, 100);

  // Overlay defaultnya full-width 16:9 (zoom=100 -> fgW = OUT_W).
  const fgW = Math.round(OUT_W * zoomFrac);
  const fgH = Math.round((fgW * 9) / 16);

  const slackX = OUT_W - fgW;
  const slackY = OUT_H - fgH;

  // posX/posY = 0 -> center sempurna. -50..50 menggeser overlay sejauh
  // setengah dari sisa ruang kosong ke kiri/kanan atau atas/bawah.
  const rawX = (slackX / 2) * (1 + posX / 50);
  const rawY = (slackY / 2) * (1 + posY / 50);

  const overlayX = Math.round(clamp(rawX, 0, Math.max(0, slackX)));
  const overlayY = Math.round(clamp(rawY, 0, Math.max(0, slackY)));

  const blurRadius = Math.round((blurAmount / 100) * MAX_BLUR_RADIUS);

  return { outW: OUT_W, outH: OUT_H, fgW, fgH, overlayX, overlayY, blurRadius, blurAmount };
}
