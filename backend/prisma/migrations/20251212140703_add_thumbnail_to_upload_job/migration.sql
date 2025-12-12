-- AlterTable
ALTER TABLE `uploadjob` ADD COLUMN `thumbnailMediaItemId` INTEGER NULL;

-- AlterTable
ALTER TABLE `youtubevideo` ADD COLUMN `thumbnailMediaItemId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
