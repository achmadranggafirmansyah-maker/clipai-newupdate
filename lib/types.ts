export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  durationSeconds: number;
  isPrivateOrUnlisted: boolean;
}

export interface SplitMoment {
  start: number; // detik, relatif ke awal clip
  end: number;
}

/**
 * Konfigurasi style "Blur Background" yang diatur user di preview editor.
 * - blurAmount: 0-100, seberapa tebal blur di layer background (0 = tajam, 100 = paling tebal).
 * - zoom: 50-150, persentase lebar overlay video utama relatif ke lebar kanvas (100 = full-width 16:9).
 * - posX / posY: -50..50, offset posisi overlay dari tengah kanvas (0 = center sempurna),
 *   dalam persen dari sisa ruang kosong di tiap sumbu.
 */
export interface StyleConfig {
  blurAmount: number;
  zoom: number;
  posX: number;
  posY: number;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  blurAmount: 20,
  zoom: 100,
  posX: 0,
  posY: 0,
};

export interface ClipPlan {
  index: number;
  startSeconds: number; // relatif ke video asli
  endSeconds: number; // relatif ke video asli
  title: string;
  reasoning: string;
  viralScore: number; // 0-100, dipakai untuk urutan hasil
  splitScreenMoments: SplitMoment[]; // relatif ke clip (start dari 0)
  transcriptSrt: string; // isi file .srt untuk clip ini
  recommendedCaption: string;
  mandatoryHashtags: string[]; // wajib dari brief campaign
  recommendedHashtags: string[]; // maks 5, relevan
  taggedPeople: string[];
}

export interface AnalyzeResult {
  videoInfo: VideoInfo;
  clips: ClipPlan[];
}

export type JobStatus =
  | 'queued'
  | 'downloading'
  | 'analyzing'
  | 'rendering'
  | 'done'
  | 'error';

export interface ClipRenderStatus {
  index: number;
  status: 'pending' | 'rendering' | 'done' | 'error';
  outputPath?: string;
  error?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  progressMessage: string;
  error?: string;
  plan?: ClipPlan[];
  videoInfo?: VideoInfo;
  renderStatuses: ClipRenderStatus[];
  createdAt: number;
}
