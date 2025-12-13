-- Ensure thumbnailMediaItemId exists on UploadJob with correct casing + FK/index
ALTER TABLE `UploadJob` ADD COLUMN IF NOT EXISTS `thumbnailMediaItemId` INTEGER NULL;

SET @uploadjob_fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'UploadJob'
    AND COLUMN_NAME = 'thumbnailMediaItemId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @uploadjob_fk_stmt := IF(
  @uploadjob_fk_name IS NULL,
  'ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE uploadjob_fk_stmt FROM @uploadjob_fk_stmt;
EXECUTE uploadjob_fk_stmt;
DEALLOCATE PREPARE uploadjob_fk_stmt;

SET @uploadjob_idx_count := (
  SELECT COUNT(1)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'UploadJob'
    AND INDEX_NAME = 'UploadJob_thumbnailMediaItemId_idx'
);
SET @uploadjob_idx_stmt := IF(
  @uploadjob_idx_count = 0,
  'CREATE INDEX `UploadJob_thumbnailMediaItemId_idx` ON `UploadJob`(`thumbnailMediaItemId`)',
  'SELECT 1'
);
PREPARE uploadjob_idx_stmt FROM @uploadjob_idx_stmt;
EXECUTE uploadjob_idx_stmt;
DEALLOCATE PREPARE uploadjob_idx_stmt;

-- Ensure thumbnailMediaItemId exists on YoutubeVideo with correct casing + FK/index
ALTER TABLE `YoutubeVideo` ADD COLUMN IF NOT EXISTS `thumbnailMediaItemId` INTEGER NULL;

SET @youtubevideo_fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'YoutubeVideo'
    AND COLUMN_NAME = 'thumbnailMediaItemId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @youtubevideo_fk_stmt := IF(
  @youtubevideo_fk_name IS NULL,
  'ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE youtubevideo_fk_stmt FROM @youtubevideo_fk_stmt;
EXECUTE youtubevideo_fk_stmt;
DEALLOCATE PREPARE youtubevideo_fk_stmt;

SET @youtubevideo_idx_count := (
  SELECT COUNT(1)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'YoutubeVideo'
    AND INDEX_NAME = 'YoutubeVideo_thumbnailMediaItemId_idx'
);
SET @youtubevideo_idx_stmt := IF(
  @youtubevideo_idx_count = 0,
  'CREATE INDEX `YoutubeVideo_thumbnailMediaItemId_idx` ON `YoutubeVideo`(`thumbnailMediaItemId`)',
  'SELECT 1'
);
PREPARE youtubevideo_idx_stmt FROM @youtubevideo_idx_stmt;
EXECUTE youtubevideo_idx_stmt;
DEALLOCATE PREPARE youtubevideo_idx_stmt;
