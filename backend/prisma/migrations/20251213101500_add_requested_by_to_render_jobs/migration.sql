-- Add requestedByUserId to RenderJob and FK to User
ALTER TABLE `RenderJob` ADD COLUMN `requestedByUserId` INTEGER NULL;

ALTER TABLE `RenderJob` ADD CONSTRAINT `RenderJob_requestedByUserId_fkey`
  FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `RenderJob_requestedByUserId_idx` ON `RenderJob`(`requestedByUserId`);
