import dotenv from 'dotenv';
import prisma from '../prismaClient';
import { processRenderJob } from './processRenderJobs';

dotenv.config();

async function main(): Promise<number> {
  const jobId = Number(process.argv[2]);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    console.error('Usage: renderJobRunner <renderJobId>');
    return 1;
  }

  try {
    const job = await prisma.renderJob.findUnique({
      where: { id: jobId },
      include: {
        audioMediaItem: true,
        imageMediaItem: true,
      },
    });

    if (!job) {
      console.error(`Render job ${jobId} not found`);
      return 1;
    }

    await processRenderJob(job);

    const refreshed = await prisma.renderJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    return refreshed?.status === 'SUCCESS' ? 0 : 1;
  } catch (err) {
    console.error('[renderJobRunner] Failed to run render job', err);
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch(async (err: unknown) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
