-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `googleSub` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatarUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_googleSub_key`(`googleSub`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_googleSub_idx`(`googleSub`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriveConnection` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `driveAccountEmail` VARCHAR(191) NOT NULL,
    `scopes` TEXT NOT NULL,
    `status` ENUM('ACTIVE', 'ERROR', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `lastError` TEXT NULL,
    `rootFolderId` VARCHAR(191) NOT NULL,
    `rootFolderName` VARCHAR(191) NOT NULL,
    `rootFolderLink` TEXT NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DriveConnection_userId_idx`(`userId`),
    INDEX `DriveConnection_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriveConsentState` (
    `state` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `nonce` VARCHAR(191) NOT NULL,
    `redirectAfter` TEXT NULL,
    `requestedFolderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`state`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YoutubeChannel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channelId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `YoutubeChannel_channelId_key`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YoutubeChannelLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `YoutubeChannelLink_channelId_idx`(`channelId`),
    INDEX `YoutubeChannelLink_userId_idx`(`userId`),
    UNIQUE INDEX `YoutubeChannelLink_userId_channelId_key`(`userId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driveFileId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NULL,
    `folderId` VARCHAR(191) NULL,
    `folderPath` TEXT NULL,
    `webViewLink` TEXT NULL,
    `webContentLink` TEXT NULL,
    `driveConnectionId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'MISSING', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaItem_driveFileId_key`(`driveFileId`),
    INDEX `MediaItem_driveConnectionId_idx`(`driveConnectionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YoutubeVideo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mediaItemId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,
    `thumbnailMediaItemId` INTEGER NULL,
    `youtubeVideoId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `tags` TEXT NULL,
    `privacyStatus` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL,
    `publishAt` DATETIME(3) NULL,
    `status` ENUM('PUBLISHED', 'SCHEDULED') NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `YoutubeVideo_youtubeVideoId_key`(`youtubeVideoId`),
    INDEX `YoutubeVideo_mediaItemId_idx`(`mediaItemId`),
    INDEX `YoutubeVideo_youtubeChannelId_idx`(`youtubeChannelId`),
    INDEX `YoutubeVideo_thumbnailMediaItemId_idx`(`thumbnailMediaItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mediaItemId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,
    `requestedByUserId` INTEGER NOT NULL,
    `youtubeVideoId` INTEGER NULL,
    `thumbnailMediaItemId` INTEGER NULL,
    `driveConnectionId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `tags` TEXT NULL,
    `privacyStatus` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL,
    `scheduledFor` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UploadJob_mediaItemId_idx`(`mediaItemId`),
    INDEX `UploadJob_youtubeChannelId_idx`(`youtubeChannelId`),
    INDEX `UploadJob_requestedByUserId_idx`(`requestedByUserId`),
    INDEX `UploadJob_youtubeVideoId_idx`(`youtubeVideoId`),
    INDEX `UploadJob_thumbnailMediaItemId_idx`(`thumbnailMediaItemId`),
    INDEX `UploadJob_driveConnectionId_idx`(`driveConnectionId`),
    INDEX `UploadJob_status_scheduledFor_idx`(`status`, `scheduledFor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RenderJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `renderSpec` TEXT NOT NULL,
    `audioMediaItemId` INTEGER NOT NULL,
    `imageMediaItemId` INTEGER NULL,
    `outputMediaItemId` INTEGER NULL,
    `requestedByUserId` INTEGER NULL,
    `driveConnectionId` VARCHAR(191) NULL,
    `waveformConfig` TEXT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RenderJob_audioMediaItemId_idx`(`audioMediaItemId`),
    INDEX `RenderJob_imageMediaItemId_idx`(`imageMediaItemId`),
    INDEX `RenderJob_outputMediaItemId_idx`(`outputMediaItemId`),
    INDEX `RenderJob_requestedByUserId_idx`(`requestedByUserId`),
    INDEX `RenderJob_driveConnectionId_idx`(`driveConnectionId`),
    INDEX `RenderJob_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DriveConnection` ADD CONSTRAINT `DriveConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeChannelLink` ADD CONSTRAINT `YoutubeChannelLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeChannelLink` ADD CONSTRAINT `YoutubeChannelLink_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `YoutubeChannel`(`channelId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_mediaItemId_fkey` FOREIGN KEY (`mediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `YoutubeChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_mediaItemId_fkey` FOREIGN KEY (`mediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `YoutubeChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_youtubeVideoId_fkey` FOREIGN KEY (`youtubeVideoId`) REFERENCES `YoutubeVideo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_thumbnailMediaItemId_fkey` FOREIGN KEY (`thumbnailMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_audioMediaItemId_fkey` FOREIGN KEY (`audioMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_imageMediaItemId_fkey` FOREIGN KEY (`imageMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_outputMediaItemId_fkey` FOREIGN KEY (`outputMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
