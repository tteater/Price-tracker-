import type { Context } from 'grammy';
import { prisma } from '../../db/prismaClient';

export async function startCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await prisma.user.upsert({
    where: { telegramId: String(ctx.from.id) },
    update: {
      username: ctx.from.username,
      firstName: ctx.from.first_name
    },
    create: {
      telegramId: String(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name
    }
  });

  await ctx.reply(
    `👋 Welcome to PriceHawk!\n\nI track product prices and alert you the moment they drop 🎯\n\n📎 Just send me any product link to start tracking.\n   Works with Amazon, Flipkart, Meesho, Myntra, AJIO & more.\n\nCommands:\n/start — Show this welcome message\n/mydeals — View all tracked products (includes each product ID)\n/remove <id> — Stop tracking a product using ID from /mydeals\n/setalert <id> <percent> — Set custom alert threshold using ID from /mydeals\n\nExample: Just paste this 👇\nhttps://www.amazon.in/dp/B09G3HRMVB\n\nExample alert command:\n/setalert <id-from-/mydeals> 5`
  );
}
