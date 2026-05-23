import { Bot } from 'grammy';
import { startCommand } from './commands/start';
import { myDealsCommand, myDealsPaginationCallback } from './commands/mydeals';
import { removeCommand, removeCallback } from './commands/remove';
import { setAlertCommand } from './commands/setalert';
import { linkMessageHandler } from './handlers/linkMessage';
import { buyNowCallback } from './callbacks/buyNow';

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

export const bot = new Bot(process.env.BOT_TOKEN);

bot.command('start', startCommand);
bot.command('mydeals', myDealsCommand);
bot.command('remove', removeCommand);
bot.command('setalert', setAlertCommand);

bot.callbackQuery(/^remove_/, removeCallback);
bot.callbackQuery(/^mydeals_page_/, myDealsPaginationCallback);
bot.callbackQuery(/^buy_now_/, buyNowCallback);
bot.callbackQuery(/^history_/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Price history UI coming soon.' });
});

bot.on('message:text', linkMessageHandler);

bot.catch((error) => {
  console.error('Bot error:', error);
});
