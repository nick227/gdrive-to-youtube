import { MediaItem, RenderJob, UploadJob } from '../../../types/api';
import { MediaRowState } from '../../../utils/mediaRowState';

export type MimeTypeFilter = 'image' | 'video' | 'audio';

export type MimeFiltersState = {
  allowed: Set<MimeTypeFilter>;
  showOther: boolean;
};

export type UploadUsageEntry = {
  count: number;
  latestStatus: string | null;
  latestTime: number;
};

export type RenderUsageEntry = {
  audioCount: number;
  imageCount: number;
  outputCount: number;
  latestStatus: string | null;
  latestTime: number;
};

export type UsageMaps = {
  uploadUsage: Map<number, UploadUsageEntry>;
  renderUsage: Map<number, RenderUsageEntry>;
};

export interface EnrichedMediaItem extends MediaItem {
  _enriched: {
    state: MediaRowState;
    mimeCategory: MimeTypeFilter | 'other';
    sizeNum: number;
    createdAtTime: number;
    formattedDate: string;
    fullPath: string;
    directoryPath: string;
    stableKey: string;
    compactStatus: string;
    usage: {
      uploadCount: number;
      latestUploadStatus: string | null;
      renderAudioCount: number;
      renderImageCount: number;
      renderOutputCount: number;
      latestRenderStatus: string | null;
    };
  };
}

export interface MediaTableData {
  media: MediaItem[];
  uploadJobs: UploadJob[];
  renderJobs: RenderJob[];
}
