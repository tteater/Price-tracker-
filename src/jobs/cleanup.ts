import cron from 'node-cron';
import { prisma } from '../db/prismaClient';

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function startCleanupJob(): void {
  const cronExpr = process.env.CLEANUP_CRON || '15 3 * * *';
  const historyDays = Number(process.env.PRICE_HISTORY_RETENTION_DAYS || 90);
  const inactiveProductDays = Number(process.env.INACTIVE_PRODUCT_RETENTION_DAYS || 30);

  cron.schedule(cronExpr, async () => {
    try {
      console.log(`[Cleanup] Running at ${new Date().toISOString()}`);

      const oldHistoryDate = daysAgo(historyDays);
      const oldInactiveDate = daysAgo(inactiveProductDays);

      const oldPricePoints = await prisma.pricePoint.deleteMany({
        where: {
          recordedAt: { lt: oldHistoryDate },
          product: {
            isActive: false
          }
        }
      });

      const oldInactiveProducts = await prisma.product.deleteMany({
        where: {
          isActive: false,
          updatedAt: { lt: oldInactiveDate }
        }
      });

      console.log(
        `[Cleanup] Done. Deleted price points: ${oldPricePoints.count}, deleted products: ${oldInactiveProducts.count}`
      );
    } catch (error) {
      console.warn('[Cleanup] Failed:', (error as Error).message);
    }
  });

  console.log(`[Cleanup] Scheduled with cron: ${cronExpr}`);
}
