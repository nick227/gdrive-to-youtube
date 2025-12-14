-- Recreate YoutubeChannelLink if it still does not exist (idempotent for MySQL with IF NOT EXISTS)
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

-- Add FK to User if missing
SET @fk_user := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'YoutubeChannelLink'
    AND CONSTRAINT_NAME = 'YoutubeChannelLink_userId_fkey'
  LIMIT 1
);
SET @stmt_user := IF(
  @fk_user IS NULL,
  'ALTER TABLE `YoutubeChannelLink` ADD CONSTRAINT `YoutubeChannelLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_user_stmt FROM @stmt_user;
EXECUTE fk_user_stmt;
DEALLOCATE PREPARE fk_user_stmt;

-- Add FK to YoutubeChannel if missing
SET @fk_channel := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'YoutubeChannelLink'
    AND CONSTRAINT_NAME = 'YoutubeChannelLink_channelId_fkey'
  LIMIT 1
);
SET @stmt_channel := IF(
  @fk_channel IS NULL,
  'ALTER TABLE `YoutubeChannelLink` ADD CONSTRAINT `YoutubeChannelLink_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `YoutubeChannel`(`channelId`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE fk_channel_stmt FROM @stmt_channel;
EXECUTE fk_channel_stmt;
DEALLOCATE PREPARE fk_channel_stmt;
