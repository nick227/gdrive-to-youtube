// Shared enums matching Prisma schema exactly

export const MediaStatus = {
  ACTIVE: 'ACTIVE',
  MISSING: 'MISSING',
  DELETED: 'DELETED',
  UPLOADED: 'UPLOADED',
} as const;

export const VideoStatus = {
  PUBLISHED: 'PUBLISHED',
  SCHEDULED: 'SCHEDULED',
} as const;

export const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  MISSING: 'MISSING',
} as const;

export const PrivacyStatus = {
  PUBLIC: 'PUBLIC',
  UNLISTED: 'UNLISTED',
  PRIVATE: 'PRIVATE',
} as const;

export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];
export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export type PrivacyStatus = (typeof PrivacyStatus)[keyof typeof PrivacyStatus];
