import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { ClipPlan, StyleConfig, DEFAULT_STYLE_CONFIG } from './types';
import { computeOverlayLayout } from './layout';

const execFileAsync = promisify(execFile);

function toBetweenExpr(moments: { start: number; end: number }[]): string {
  if (!moments.length) return '0';
  return moments
    .map((m) => `between(t,${Math.max(0, m.start)},${Math.max(0, m.end)})`)
    .join('+');
}

/**
 * Style #1: Blur Background.
 * - Layer background: seluruh frame di-crop-fill 9:16 penuh, lalu diblur sesuai blurAmount.
 * - Layer overlay: video asli di-crop ke rasio 16:9 (tanpa zoom paksa), di-scale sesuai
 *   `zoom`, lalu ditumpuk di kanvas pada posisi `posX`/`posY` (default: tengah).
 * - Saat ada momen splitScreenMoments (video podcast 2 kamera), overlay di atas
 *   ditutup penuh oleh layer split-screen (kiri/kanan jadi atas/bawah).
 */
function buildFilterComplex(
  splitMoments: { start: number; end: number }[],
  styleConfig: StyleConfig,
) {
  const hasSplit = splitMoments.length > 0;
  const enableExpr = toBetweenExpr(splitMoments);
  const layout = computeOverlayLayout(styleConfig);

  const parts: string[] = [];

  parts.push(`[0:v]setpts=PTS-STARTPTS,split=${hasSplit ? 3 : 2}[bgin][fgin]${hasSplit ? '[spin]' : ''}`);

  // Background: crop-fill 9:16 penuh + blur (radius 0 = tanpa efek blur sama sekali)
  const blurStage = layout.blurRadius > 0 ? `,boxblur=${layout.blurRadius}:${layout.blurRadius}` : '';
  parts.push(
    `[bgin]scale=${layout.outW}:${layout.outH}:force_original_aspect_ratio=increase,crop=${layout.outW}:${layout.outH}${blurStage}[bg]`,
  );

  // Foreground: crop ke rasio 16:9 dari tengah frame asli (tidak dipaksa zoom),
  // lalu scale ke ukuran overlay sesuai slider zoom.
  parts.push(
    `[fgin]crop='min(iw\\,ih*16/9)':'min(ih\\,iw*9/16)':'(iw-min(iw\\,ih*16/9))/2':'(ih-min(ih\\,iw*9/16))/2',scale=${layout.fgW}:${layout.fgH}[fg]`,
  );
  parts.push(`[bg][fg]overlay=${layout.overlayX}:${layout.overlayY}[normal]`);

  let lastLabel = 'normal';

  if (hasSplit) {
    // Pecah frame asli jadi kiri & kanan (dua orang), lalu tumpuk atas-bawah,
    // menutup penuh layer blur+overlay selama momen split berlangsung.
    parts.push(`[spin]split=2[spinL0][spinR0]`);
    parts.push(
      `[spinL0]crop=iw/2:ih:0:0,scale=${layout.outW}:${Math.round(layout.outH / 2)}[spinL]`,
    );
    parts.push(
      `[spinR0]crop=iw/2:ih:iw/2:0,scale=${layout.outW}:${Math.round(layout.outH / 2)}[spinR]`,
    );
    parts.push(`[spinL][spinR]vstack=2[splitfull]`);
    parts.push(
      `[normal][splitfull]overlay=0:0:enable='${enableExpr}'[vout]`,
    );
    lastLabel = 'vout';
  }

  return { filter: parts.join(';'), outputLabel: lastLabel };
}

async function writeSrtFile(srtContent: string, outDir: string, index: number) {
  const srtPath = path.join(outDir, `clip-${index}.srt`);
  await fs.writeFile(srtPath, srtContent || '1\n00:00:00,000 --> 00:00:01,000\n \n', 'utf-8');
  return srtPath;
}

interface RenderParams {
  sourcePath: string;
  clip: ClipPlan;
  outDir: string;
  styleConfig?: StyleConfig;
}

/**
 * Render satu clip. HARUS dipanggil satu-satu (sequential) oleh caller,
 * jangan di-Promise.all-kan, sesuai aturan produk (tidak render paralel).
 */
export async function renderClip({ sourcePath, clip, outDir, styleConfig }: RenderParams): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });

  const cfg = styleConfig ?? DEFAULT_STYLE_CONFIG;
  const duration = clip.endSeconds - clip.startSeconds;
  const srtPath = await writeSrtFile(clip.transcriptSrt, outDir, clip.index);
  const outputPath = path.join(outDir, `clip-${clip.index}.mp4`);

  const { filter, outputLabel } = buildFilterComplex(clip.splitScreenMoments, cfg);

  // subtitle wajib selalu aktif (tombol auto caption permanen ON) -> selalu di-burn
  const escapedSrt = srtPath.replace(/:/g, '\\:');
  const fullFilter = `${filter};[${outputLabel}]subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=90'[final]`;

  const args = [
    '-y',
    '-ss', String(clip.startSeconds),
    '-to', String(clip.endSeconds),
    '-i', sourcePath,
    '-filter_complex', fullFilter,
    '-map', '[final]',
    '-map', '0:a?',
    '-t', String(duration),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '21',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ];

  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 50 });

  return outputPath;
}
