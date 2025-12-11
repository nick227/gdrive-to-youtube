-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `googleSub` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_googleSub_key`(`googleSub`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YoutubeChannel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerUserId` INTEGER NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `scopes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `YoutubeChannel_channelId_key`(`channelId`),
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
    `folderPath` VARCHAR(191) NULL,
    `webViewLink` VARCHAR(191) NULL,
    `webContentLink` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'MISSING', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaItem_driveFileId_key`(`driveFileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YoutubeVideo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mediaItemId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,
    `youtubeVideoId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `tags` VARCHAR(191) NULL,
    `privacyStatus` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL,
    `publishAt` DATETIME(3) NULL,
    `status` ENUM('PUBLISHED', 'SCHEDULED') NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `YoutubeVideo_youtubeVideoId_key`(`youtubeVideoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mediaItemId` INTEGER NOT NULL,
    `youtubeChannelId` INTEGER NOT NULL,
    `requestedByUserId` INTEGER NOT NULL,
    `youtubeVideoId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `tags` VARCHAR(191) NULL,
    `privacyStatus` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL,
    `scheduledFor` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RenderJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audioMediaItemId` INTEGER NOT NULL,
    `imageMediaItemId` INTEGER NULL,
    `outputMediaItemId` INTEGER NULL,
    `waveformConfig` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `YoutubeChannel` ADD CONSTRAINT `YoutubeChannel_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_mediaItemId_fkey` FOREIGN KEY (`mediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `YoutubeVideo` ADD CONSTRAINT `YoutubeVideo_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `YoutubeChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_mediaItemId_fkey` FOREIGN KEY (`mediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `YoutubeChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_youtubeVideoId_fkey` FOREIGN KEY (`youtubeVideoId`) REFERENCES `YoutubeVideo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_audioMediaItemId_fkey` FOREIGN KEY (`audioMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_imageMediaItemId_fkey` FOREIGN KEY (`imageMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_outputMediaItemId_fkey` FOREIGN KEY (`outputMediaItemId`) REFERENCES `MediaItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
