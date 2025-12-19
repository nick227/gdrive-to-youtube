import { useMemo } from 'react';
import type { RenderJob, UploadJob, JobStatus } from '../types/api';
import { JobStatus as JobStatusEnum } from '../types/enums';
import StatusBadge from './ui/StatusBadge';

type BadgeStatus = 'pending' | 'running' | 'success' | 'failed' | 'scheduled' | 'missing';

interface PendingJobsListProps {
    uploadJobs: UploadJob[];
    renderJobs: RenderJob[];
    onRefresh: () => void;
    onToggle: () => void;
    isOpen?: boolean;
}

interface PendingJobRow {
    id: string;
    kind: 'upload' | 'render';
    title: string;
    subtitle?: string;
    userLabel?: string;
    createdAt: string;
    status: BadgeStatus;
    scheduledTime?: string;
    linkLabel?: string;
    linkHref?: string;
    error?: string | null;
    meta?: string;
}

function formatDate(value?: string | null): string {
    if (!value) return 'Unknown time';
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) return 'Unknown time';
    return t.toLocaleString();
}

function normalizeJobStatus(
    status: JobStatus,
    scheduledFor?: string | null
): { status: BadgeStatus; scheduledTime?: string } {
    if (status === JobStatusEnum.PENDING && scheduledFor) {
        const t = Date.parse(scheduledFor);
        if (Number.isFinite(t) && t > Date.now()) {
            return { status: 'scheduled', scheduledTime: scheduledFor };
        }
    }

    const map: Record<JobStatus, BadgeStatus> = {
        [JobStatusEnum.PENDING]: 'pending',
        [JobStatusEnum.RUNNING]: 'running',
        [JobStatusEnum.SUCCESS]: 'success',
        [JobStatusEnum.FAILED]: 'failed',
        [JobStatusEnum.MISSING]: 'missing',
    };

    return { status: map[status] };
}

function safeTime(value: string): number {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : -Infinity;
}

export default function PendingJobsList({
    uploadJobs,
    renderJobs,
    onToggle,
    isOpen = false,
}: PendingJobsListProps) {
    const rows = useMemo<PendingJobRow[]>(() => {
        const uploadRows: PendingJobRow[] = uploadJobs.map((job) => {
            const { status, scheduledTime } = normalizeJobStatus(job.status, job.scheduledFor);

            const youtubeId = job.youtubeVideo?.youtubeVideoId ?? undefined;
            const title = job.title || job.mediaItem?.name || 'Upload job';
            const meta =
                job.mediaItem?.name && job.mediaItem.name !== title ? job.mediaItem.name : undefined;

            const subtitle =
                job.youtubeChannel?.title || job.youtubeChannel?.channelId || undefined;
            const userLabel = job.requestedByUser?.email || job.requestedByUser?.name || undefined;

            return {
                id: `upload-${job.id}`,
                kind: 'upload',
                title,
                subtitle,
                userLabel,
                createdAt: job.createdAt,
                status,
                scheduledTime,
                linkLabel: youtubeId ? 'View on YouTube' : undefined,
                linkHref: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
                error: job.errorMessage,
                meta,
            };
        });

        const renderRows: PendingJobRow[] = renderJobs.map((job) => {
            // If RenderJob can be scheduled, pass job.scheduledFor here (or whatever field exists).
            const { status } = normalizeJobStatus(job.status);

            const audioName = job.audioMediaItem?.name || 'Audio';
            const imageName = job.imageMediaItem?.name ? ` + ${job.imageMediaItem.name}` : '';
            const computed = `${audioName}${imageName}`;

            const title = job.outputMediaItem?.name || computed;
            const meta = computed !== title ? computed : undefined;

            const outputLink = job.outputMediaItem?.webViewLink ?? undefined;
            const userLabel = job.requestedByUser?.email || job.requestedByUser?.name || undefined;

            return {
                id: `render-${job.id}`,
                kind: 'render',
                title,
                subtitle: `Render job #${job.id}`,
                userLabel,
                createdAt: job.createdAt,
                status,
                linkLabel: outputLink ? 'View output' : undefined,
                linkHref: outputLink,
                error: job.errorMessage,
                meta,
            };
        });

        return [...uploadRows, ...renderRows].sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
    }, [uploadJobs, renderJobs]);

    return (
        <div className="mt-2">
            <div onClick={onToggle} className="flex justify-between rounded bg-slate-50 p-3 cursor-pointer">
                
                    <h3 className="section-title m-0">
                        History {rows.length > 0 && `(${rows.length})`}
                    </h3>
                        <i className={`cursor-pointer fa-solid ${!isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            </div>
            {!isOpen && (
                <div className="d-flex flex-column gap-2 item-list h-60 overflow-y-auto">
                    {rows.map((row) => (
                    <div
                        key={row.id}
                        className="d-flex flex-column gap-1  odd:bg-white even:bg-slate-100 px-1 my-4"
                    >
                        <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">{row.title}</div>

                            <div className="text-muted text-xs">{formatDate(row.createdAt)}</div>
                        </div>

                        <div className="my-2">
                            <div className="text-sm">
                            Type: {row.kind}
                            </div>
                            <div className="text-sm">
                            Status: <StatusBadge status={row.status} scheduledTime={row.scheduledTime} />
                            </div>
                            {row.subtitle && <div className="text-muted text-sm">Channel: {row.subtitle}</div>}
                            {row.userLabel && <div className="text-muted text-sm">Requested by: {row.userLabel}</div>}
                            {row.meta && <div className="text-muted text-sm">Source: {row.meta}</div>}
                            {row.linkHref && (
                                <a
                                    href={row.linkHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm"
                                >
                                    {row.linkLabel || 'View'}
                                </a>
                            )}
                        </div>

                        {row.error && <div className="text-error text-xs">{row.error}</div>}
                    </div>
                    ))}
                </div>
            )}
        </div>
    );
}
