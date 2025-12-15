/*
  Warnings:

  - You are about to drop the column `accessToken` on the `youtubechannel` table. All the data in the column will be lost.
  - You are about to drop the column `ownerUserId` on the `youtubechannel` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `youtubechannel` table. All the data in the column will be lost.
  - You are about to drop the column `scopes` on the `youtubechannel` table. All the data in the column will be lost.
  - Added the required column `renderSpec` to the `RenderJob` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `youtubechannel` DROP FOREIGN KEY `YoutubeChannel_ownerUserId_fkey`;

-- AlterTable
ALTER TABLE `mediaitem` MODIFY `folderPath` TEXT NULL,
    MODIFY `webViewLink` TEXT NULL,
    MODIFY `webContentLink` TEXT NULL;

-- AlterTable
ALTER TABLE `renderjob` ADD COLUMN `renderSpec` TEXT NOT NULL,
    MODIFY `waveformConfig` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `uploadjob` MODIFY `description` TEXT NOT NULL,
    MODIFY `tags` TEXT NULL,
    MODIFY `errorMessage` TEXT NULL;

-- AlterTable
ALTER TABLE `youtubechannel` DROP COLUMN `accessToken`,
    DROP COLUMN `ownerUserId`,
    DROP COLUMN `refreshToken`,
    DROP COLUMN `scopes`;

-- AlterTable
ALTER TABLE `youtubechannellink` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `youtubevideo` MODIFY `description` TEXT NOT NULL,
    MODIFY `tags` TEXT NULL;

-- CreateIndex
CREATE INDEX `RenderJob_status_idx` ON `RenderJob`(`status`);

-- CreateIndex
CREATE INDEX `UploadJob_status_scheduledFor_idx` ON `UploadJob`(`status`, `scheduledFor`);

-- CreateIndex
CREATE INDEX `User_email_idx` ON `User`(`email`);

-- CreateIndex
CREATE INDEX `User_googleSub_idx` ON `User`(`googleSub`);

-- RenameIndex
ALTER TABLE `renderjob` RENAME INDEX `RenderJob_audioMediaItemId_fkey` TO `RenderJob_audioMediaItemId_idx`;

-- RenameIndex
ALTER TABLE `renderjob` RENAME INDEX `RenderJob_imageMediaItemId_fkey` TO `RenderJob_imageMediaItemId_idx`;

-- RenameIndex
ALTER TABLE `renderjob` RENAME INDEX `RenderJob_outputMediaItemId_fkey` TO `RenderJob_outputMediaItemId_idx`;

-- RenameIndex
ALTER TABLE `uploadjob` RENAME INDEX `UploadJob_mediaItemId_fkey` TO `UploadJob_mediaItemId_idx`;

-- RenameIndex
ALTER TABLE `uploadjob` RENAME INDEX `UploadJob_requestedByUserId_fkey` TO `UploadJob_requestedByUserId_idx`;

-- RenameIndex
ALTER TABLE `uploadjob` RENAME INDEX `UploadJob_youtubeChannelId_fkey` TO `UploadJob_youtubeChannelId_idx`;

-- RenameIndex
ALTER TABLE `uploadjob` RENAME INDEX `UploadJob_youtubeVideoId_fkey` TO `UploadJob_youtubeVideoId_idx`;

-- RenameIndex
ALTER TABLE `youtubevideo` RENAME INDEX `YoutubeVideo_mediaItemId_fkey` TO `YoutubeVideo_mediaItemId_idx`;

-- RenameIndex
ALTER TABLE `youtubevideo` RENAME INDEX `YoutubeVideo_youtubeChannelId_fkey` TO `YoutubeVideo_youtubeChannelId_idx`;
