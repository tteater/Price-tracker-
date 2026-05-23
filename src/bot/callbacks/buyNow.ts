import type { Context } from 'grammy';

export async function buyNowCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Opening best deal…' });
}
