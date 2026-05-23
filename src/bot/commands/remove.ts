import type { Context } from 'grammy';
import { prisma } from '../../db/prismaClient';

export async function removeCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  if (typeof ctx.message.text !== 'string') return;

  const args = ctx.message.text.trim().split(/\s+/);
  const productId = args[1];

  if (!productId) {
    await ctx.reply('Usage: /remove <id>');
    return;
  }

  await removeProductForUser(ctx, productId);
}

export async function removeCallback(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery?.data) return;

  const productId = ctx.callbackQuery.data.replace('remove_', '');
  await removeProductForUser(ctx, productId, true);
}

async function removeProductForUser(ctx: Context, productId: string, fromCallback = false): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from!.id) }
  });

  if (!user) {
    const msg = 'User not found. Please run /start first.';
    if (fromCallback) await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    else await ctx.reply(msg);
    return;
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      userId: user.id,
      isActive: true
    }
  });

  if (!product) {
    const msg = 'Product not found or already removed.';
    if (fromCallback) await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    else await ctx.reply(msg);
    return;
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { isActive: false }
  });

  const replyText = `🗑 Stopped tracking ${product.productName ?? 'this product'}.`;

  if (fromCallback) {
    await ctx.answerCallbackQuery({ text: 'Removed.' });
    await ctx.reply(replyText);
    return;
  }

  await ctx.reply(replyText);
}
