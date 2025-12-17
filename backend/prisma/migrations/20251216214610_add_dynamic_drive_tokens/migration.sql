-- AlterTable
ALTER TABLE `mediaitem` ADD COLUMN `driveConnectionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `renderjob` ADD COLUMN `driveConnectionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `uploadjob` ADD COLUMN `driveConnectionId` VARCHAR(191) NULL;

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

-- CreateIndex
CREATE INDEX `MediaItem_driveConnectionId_idx` ON `MediaItem`(`driveConnectionId`);

-- CreateIndex
CREATE INDEX `RenderJob_driveConnectionId_idx` ON `RenderJob`(`driveConnectionId`);

-- CreateIndex
CREATE INDEX `UploadJob_driveConnectionId_idx` ON `UploadJob`(`driveConnectionId`);

-- AddForeignKey
ALTER TABLE `DriveConnection` ADD CONSTRAINT `DriveConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_driveConnectionId_fkey` FOREIGN KEY (`driveConnectionId`) REFERENCES `DriveConnection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
