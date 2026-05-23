import 'dotenv/config';
import { bot } from './bot';
import { startPriceCheckerJob } from './jobs/priceChecker';
import { startCleanupJob } from './jobs/cleanup';
import { registerAlerterBot } from './services/alerter';

async function bootstrap(): Promise<void> {
  registerAlerterBot(bot);
  startPriceCheckerJob();
  startCleanupJob();
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.start();
  console.log('PriceHawk bot started successfully');
}

bootstrap().catch((error) => {
  console.error('Failed to start PriceHawk bot:', error);
  process.exit(1);
});
