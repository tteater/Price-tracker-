import cron from 'node-cron';
import { prisma } from '../db/prismaClient';
import { scrapeProductPrice } from '../services/priceScraper';
import { checkAndAlert } from '../services/alerter';

export function startPriceCheckerJob(): void {
  const cronExpr = process.env.CHECK_INTERVAL_CRON || '0 * * * *';

  cron.schedule(cronExpr, async () => {
    console.log(`[PriceChecker] Running at ${new Date().toISOString()}`);

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { user: true }
    });

    for (const product of products) {
      try {
        const { price } = await scrapeProductPrice(product.originalUrl);

        if (price != null) {
          await checkAndAlert(product, price);

          await prisma.$transaction([
            prisma.pricePoint.create({
              data: {
                productId: product.id,
                price
              }
            }),
            prisma.product.update({
              where: { id: product.id },
              data: { currentPrice: price }
            })
          ]);
        }
      } catch (error) {
        console.warn(`[PriceChecker] Failed for product ${product.id}:`, (error as Error).message);
      }
    }
  });

  console.log(`[PriceChecker] Scheduled with cron: ${cronExpr}`);
}
