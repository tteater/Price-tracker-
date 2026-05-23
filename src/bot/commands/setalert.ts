import type { Context } from 'grammy';
import { prisma } from '../../db/prismaClient';

export async function setAlertCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  if (typeof ctx.message.text !== 'string') return;

  const args = ctx.message.text.trim().split(/\s+/);
  const productId = args[1];
  const percentRaw = args[2];

  if (!productId || !percentRaw) {
    await ctx.reply('Usage: /setalert <id> <percent>');
    return;
  }

  const percent = parseFloat(percentRaw);
  if (!Number.isFinite(percent) || percent < 0.5 || percent > 50) {
    await ctx.reply('Please set a valid percent between 0.5 and 50.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply('User not found. Please run /start first.');
    return;
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: user.id, isActive: true }
  });

  if (!product) {
    await ctx.reply('Product not found.');
    return;
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { alertThreshold: percent }
  });

  await ctx.reply(
    `✅ Alert updated! I'll notify you when ${product.productName ?? 'this product'} drops by ${percent}% or more.`
  );
}
