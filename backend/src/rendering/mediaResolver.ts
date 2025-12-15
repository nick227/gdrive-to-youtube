import type { RenderJob, MediaItem } from '@prisma/client';
import prisma from '../prismaClient';
import { normalizeIdList, parseRenderSpec, RenderSpec } from './renderSpec';

export type RenderJobWithRelations = RenderJob & {
  audioMediaItem: MediaItem;
  imageMediaItem: MediaItem | null;
};

export type ResolvedMedia = {
  spec: RenderSpec | null;
  audioItems: MediaItem[];
  imageItems: MediaItem[];
};

async function loadMediaItemsByIds(ids: number[]): Promise<Map<number, MediaItem>> {
  if (ids.length === 0) return new Map();
  const records = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
  });
  const map = new Map<number, MediaItem>();
  for (const item of records) {
    map.set(item.id, item);
  }
  return map;
}

function validateMime(item: MediaItem, expectedPrefix: 'audio/' | 'image/'): void {
  if (!item.mimeType.startsWith(expectedPrefix)) {
    throw new Error(
      `Media item ${item.id} has mimeType=${item.mimeType}, expected to start with ${expectedPrefix}`
    );
  }
}

export async function resolveRenderMedia(
  job: RenderJobWithRelations,
  preParsedSpec?: RenderSpec | null
): Promise<ResolvedMedia> {
  const spec = preParsedSpec ?? parseRenderSpec(job.renderSpec);

  const audioIds = spec ? normalizeIdList(spec.audios) : normalizeIdList([job.audioMediaItemId]);
  const imageIds =
    spec && spec.mode === 'slideshow'
      ? normalizeIdList(spec.images)
      : normalizeIdList(job.imageMediaItemId ? [job.imageMediaItemId] : []);

  if (audioIds.length === 0) {
    throw new Error('No audio tracks provided in renderSpec or job');
  }

  const mediaCache = new Map<number, MediaItem>();
  mediaCache.set(job.audioMediaItem.id, job.audioMediaItem);
  if (job.imageMediaItem) {
    mediaCache.set(job.imageMediaItem.id, job.imageMediaItem);
  }

  const missingIds = [...audioIds, ...imageIds].filter((id) => !mediaCache.has(id));
  if (missingIds.length > 0) {
    const fetched = await loadMediaItemsByIds(missingIds);
    for (const [id, item] of fetched.entries()) {
      mediaCache.set(id, item);
    }
  }

  const audioItems = audioIds.map((id) => {
    const found = mediaCache.get(id);
    if (!found) {
      throw new Error(`Audio media item ${id} not found`);
    }
    validateMime(found, 'audio/');
    return found;
  });

  const imageItems = imageIds.map((id) => {
    const found = mediaCache.get(id);
    if (!found) {
      throw new Error(`Image media item ${id} not found`);
    }
    validateMime(found, 'image/');
    return found;
  });

  return { spec, audioItems, imageItems };
}
