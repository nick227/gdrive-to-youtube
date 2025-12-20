import { useMemo } from 'react';
import type { UploadJob } from '../types/api';
import type { ScheduleItem } from '../components/schedule/types';

function mapUploadJobsToScheduleItems(jobs: UploadJob[]): ScheduleItem[] {
  return jobs
    .filter(j => j.scheduledFor)
    .map(j => {
      const [date, time] = j.scheduledFor!.split('T');
      return {
        id: j.id,
        date,
        time: time?.slice(0, 5),
        title: j.title,
        status: j.youtubeVideo?.status ?? j.status,
        channelTitle: j.youtubeChannel?.title ?? null,
        privacyStatus: j.privacyStatus,
      };
    });
}

export function useScheduleItems(uploadJobs: UploadJob[]) {
  return useMemo(() => mapUploadJobsToScheduleItems(uploadJobs), [uploadJobs]);
}
