import { InlineKeyboard, type Context } from 'grammy';
import { prisma } from '../../db/prismaClient';
import { formatCurrency, truncateText } from '../../utils/formatter';

const PAGE_SIZE = 5;

function renderDealsPage(products: any[], page: number): { text: string; keyboard: InlineKeyboard } {
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = products.slice(start, start + PAGE_SIZE);

  const keyboard = new InlineKeyboard();
  const lines = [`📋 Your tracked products (Page ${safePage}/${totalPages})`, ''];

  for (const product of pageItems) {
    lines.push(
      `📦 ${truncateText(product.productName, 40)}`,
      `💰 ${formatCurrency(product.currentPrice)}  |  🏪 ${product.platform}`,
      `🔔 Alert at: ${product.alertThreshold}% drop`,
      `ID: ${product.id}`,
      ''
    );

    keyboard
      .text('🗑 Remove', `remove_${product.id}`)
      .text('📈 History', `history_${product.id}`)
      .row();
  }

  if (totalPages > 1) {
    if (safePage > 1) keyboard.text('⬅ Prev', `mydeals_page_${safePage - 1}`);
    if (safePage < totalPages) keyboard.text('Next ➡', `mydeals_page_${safePage + 1}`);
  }

  return { text: lines.join('\n').trim(), keyboard };
}

export async function myDealsCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  const products = user?.products ?? [];

  if (products.length === 0) {
    await ctx.reply('You have no tracked products yet. Just send me a product link to start! 🔗');
    return;
  }

  const { text, keyboard } = renderDealsPage(products, 1);
  await ctx.reply(text, { reply_markup: keyboard });
}

export async function myDealsPaginationCallback(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery?.data) return;

  const page = parseInt(ctx.callbackQuery.data.split('_').pop() ?? '1', 10);

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  const products = user?.products ?? [];
  if (products.length === 0) {
    await ctx.answerCallbackQuery({ text: 'No active products.' });
    return;
  }

  const { text, keyboard } = renderDealsPage(products, page);
  await ctx.editMessageText(text, { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
