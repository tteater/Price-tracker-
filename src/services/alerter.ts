import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import type { Product, User } from '@prisma/client';
import { prisma } from '../db/prismaClient';
import { formatCurrency, formatDropPercent } from '../utils/formatter';

type ProductWithUser = Product & { user: User };

let botInstance: Bot | null = null;

export function registerAlerterBot(bot: Bot): void {
  botInstance = bot;
}

export async function checkAndAlert(product: ProductWithUser, newPrice: number): Promise<void> {
  const refPrice = product.lastAlertPrice ?? product.currentPrice;

  if (refPrice == null || refPrice <= 0) {
    await prisma.product.update({
      where: { id: product.id },
      data: { lastAlertPrice: newPrice }
    });
    return;
  }

  const dropPercent = ((refPrice - newPrice) / refPrice) * 100;
  if (dropPercent < product.alertThreshold) return;

  const saved = refPrice - newPrice;
  const message =
    `🔥 Price Drop Alert!\n\n` +
    `📦 ${product.productName ?? 'Tracked Product'}\n\n` +
    `Was: ${formatCurrency(refPrice)}\n` +
    `Now: ${formatCurrency(newPrice)}\n` +
    `🎯 You save: ${formatCurrency(saved)} (${formatDropPercent(dropPercent)}% off)\n\n` +
    `⏰ Grab it before it goes back up!`;

  if (botInstance) {
    await botInstance.api.sendMessage(product.user.telegramId, message, {
      reply_markup: new InlineKeyboard().url('🛒 Buy Now — Best Price', product.affiliateUrl)
    });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { lastAlertPrice: newPrice }
  });
}
