-- AlterTable
-- Use correct table casing to work across case-sensitive filesystems
ALTER TABLE `UploadJob` ADD COLUMN `thumbnailMediaItemId` INTEGER NULL;

-- AlterTable
ALTER TABLE `YoutubeVideo` ADD COLUMN `thumbnailMediaItemId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
