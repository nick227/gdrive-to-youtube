/*
  Warnings:

  - You are about to drop the column `errorMessage` on the `youtubevideo` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `youtubevideo` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(5))` to `Enum(EnumId(2))`.

*/
-- AlterTable
ALTER TABLE `uploadjob` ADD COLUMN `youtubeVideoId` INTEGER NULL;

-- AlterTable
ALTER TABLE `youtubevideo` DROP COLUMN `errorMessage`,
    MODIFY `status` ENUM('PUBLISHED', 'SCHEDULED') NOT NULL DEFAULT 'PUBLISHED';

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_youtubeVideoId_fkey` FOREIGN KEY (`youtubeVideoId`) REFERENCES `YoutubeVideo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
