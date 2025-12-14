-- Create YoutubeChannelLink table if missing (matches schema.prisma)
CREATE TABLE IF NOT EXISTS `YoutubeChannelLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `YoutubeChannelLink_userId_channelId_key`(`userId`, `channelId`),
    INDEX `YoutubeChannelLink_channelId_idx`(`channelId`),
    INDEX `YoutubeChannelLink_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add FKs (guarded)
ALTER TABLE `YoutubeChannelLink`
  ADD CONSTRAINT `YoutubeChannelLink_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `YoutubeChannelLink`
  ADD CONSTRAINT `YoutubeChannelLink_channelId_fkey`
  FOREIGN KEY (`channelId`) REFERENCES `YoutubeChannel`(`channelId`) ON DELETE CASCADE ON UPDATE CASCADE;
