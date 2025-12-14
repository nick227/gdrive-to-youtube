import { useMemo } from 'react';
import type { RenderJob, UploadJob, JobStatus } from '../types/api';
import { JobStatus as JobStatusEnum } from '../types/enums';
import StatusBadge from './ui/StatusBadge';

type BadgeStatus = 'pending' | 'running' | 'success' | 'failed' | 'scheduled' | 'missing';

interface PendingJobsListProps {
    uploadJobs: UploadJob[];
    renderJobs: RenderJob[];
    onRefresh: () => void;
    loading?: boolean;
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
    onRefresh,
    loading = false,
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
        <div className="section" style={{ marginBottom: '1.5rem' }}>
            <div className="flex justify-between items-end mb-2 w-full">
                <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                        History
                    </h3>
                </div>

                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={onRefresh}
                    disabled={loading}
                >

                    {loading ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                    ) : (
                        <i className="fa-solid fa-rotate" />
                    )}
                </button>
            </div>

            {rows.length === 0 ? (
                <div className="alert alert-info" style={{ marginBottom: 0 }}>
                    No jobs yet. Create an upload or render to see it here.
                </div>
            ) : (
                <div className="d-flex flex-column gap-2">
                    {rows.map((row) => (
                        <div
                            key={row.id}
                            className="d-flex flex-column gap-1"
                            style={{
                                border: '1px solid #eee',
                                borderRadius: 8,
                                padding: '10px 12px',
                                background: '#fafafa',
                            }}
                        >
                            <div className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                                        {row.kind}
                                    </div>
                                    <strong>{row.title}</strong>
                                </div>

                                <div className="text-muted text-xs">{formatDate(row.createdAt)}</div>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <StatusBadge status={row.status} scheduledTime={row.scheduledTime} />
                                {row.subtitle && <div className="text-muted text-sm">{row.subtitle}</div>}
                                {row.userLabel && <div className="text-muted text-sm">• {row.userLabel}</div>}
                                {row.meta && <div className="text-muted text-sm">• {row.meta}</div>}
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
