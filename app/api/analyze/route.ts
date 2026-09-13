import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createJob } from '@/lib/jobs';
import { startJob } from '@/lib/pipeline';
import { DEFAULT_STYLE_CONFIG, StyleConfig } from '@/lib/types';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeStyleConfig(input: any): StyleConfig {
  if (!input) return DEFAULT_STYLE_CONFIG;
  return {
    blurAmount: clamp(Number(input.blurAmount) || DEFAULT_STYLE_CONFIG.blurAmount, 0, 100),
    zoom: clamp(Number(input.zoom) || DEFAULT_STYLE_CONFIG.zoom, 50, 150),
    posX: clamp(Number(input.posX) || 0, -50, 50),
    posY: clamp(Number(input.posY) || 0, -50, 50),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { apiKey, youtubeUrl, briefUrl, clipCount, styleConfig } = body;

  if (!apiKey || !youtubeUrl) {
    return NextResponse.json({ error: 'API key & URL YouTube wajib diisi.' }, { status: 400 });
  }
  const count = Math.min(8, Math.max(5, Number(clipCount) || 6));

  const jobId = uuidv4();
  createJob(jobId);

  // dijalankan di background, endpoint langsung balas jobId supaya
  // frontend bisa polling status tanpa request nge-hang lama
  startJob({
    jobId,
    apiKey,
    youtubeUrl,
    briefUrl: briefUrl || '',
    clipCount: count,
    maxClipSeconds: 60,
    styleConfig: sanitizeStyleConfig(styleConfig),
  }).catch(() => {
    /* error sudah ditangani & disimpan di dalam startJob */
  });

  return NextResponse.json({ jobId });
}
