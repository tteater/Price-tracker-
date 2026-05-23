import { InlineKeyboard, type Context } from 'grammy';
import { prisma } from '../../db/prismaClient';
import { convertToAffiliateLink } from '../../services/earnkaro';
import { scrapeProductPrice } from '../../services/priceScraper';
import { resolveFinalUrl } from '../../services/urlResolver';
import {
  canonicalizeAmazonProductUrl,
  detectPlatform,
  extractFirstUrl,
  isSupportedPlatform,
  normalizeUrlForDedup
} from '../../utils/urlParser';
import { formatCurrency } from '../../utils/formatter';

export async function linkMessageHandler(ctx: Context): Promise<void> {
  try {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const messageText = ctx.message.text;
    if (typeof messageText !== 'string') return;
    const extractedUrl = extractFirstUrl(messageText);

    if (!extractedUrl) return;
    const resolvedUrl = await resolveFinalUrl(extractedUrl);
    let trackUrl = resolvedUrl;

    if (resolvedUrl.includes('amazon.')) {
      const canonicalAmazonUrl = canonicalizeAmazonProductUrl(resolvedUrl);
      if (!canonicalAmazonUrl) {
        await ctx.reply(
          '⚠️ Please send a direct Amazon product link (with /dp/ASIN or /gp/product/ASIN). Category/listing pages cannot be tracked.'
        );
        return;
      }
      trackUrl = canonicalAmazonUrl;
    }

    if (!isSupportedPlatform(trackUrl)) {
      await ctx.reply(
        '🤔 I only track shopping links right now.\nSupported: Amazon, Flipkart, Meesho, Myntra, AJIO, Snapdeal'
      );
      return;
    }

    const normalizedUrl = normalizeUrlForDedup(trackUrl);
    const user = await prisma.user.upsert({
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

    const existingProduct = await prisma.product.findFirst({
      where: {
        userId: user.id,
        originalUrl: normalizedUrl,
        isActive: true
      }
    });

    if (existingProduct) {
      await ctx.reply(
        `📌 Already tracking this!\nCurrent price: ${formatCurrency(existingProduct.currentPrice)}\nI'll alert you when it drops 🔔`
      );
      return;
    }

    await ctx.replyWithChatAction('typing');
    const ack = await ctx.reply('⏳ Got it! Fetching product details...');

    let [scrapeResult, affiliateUrl] = await Promise.all([
      scrapeProductPrice(trackUrl),
      convertToAffiliateLink(trackUrl)
    ]);

    if (scrapeResult.price == null) {
      // One immediate retry helps for temporary anti-bot/interstitial pages.
      scrapeResult = await scrapeProductPrice(trackUrl);
    }

    const platform = detectPlatform(trackUrl);

    const created = await prisma.product.create({
      data: {
        userId: user.id,
        originalUrl: normalizedUrl,
        affiliateUrl: affiliateUrl || extractedUrl,
        productName: scrapeResult.name,
        currentPrice: scrapeResult.price,
        platform
      }
    });

    if (scrapeResult.price != null) {
      await prisma.pricePoint.create({
        data: {
          productId: created.id,
          price: scrapeResult.price
        }
      });
    }

    if (scrapeResult.price == null) {
      const blockedPlatformMsg =
        platform === 'AJIO'
          ? "✅ Tracking started! AJIO is blocking automated price fetch right now from this server/network. I'll keep tracking and retry on scheduled checks."
          : null;

      await ctx.api.editMessageText(
        ctx.chat!.id,
        ack.message_id,
        blockedPlatformMsg ?? '✅ Tracking started! (couldn\'t fetch price right now — I\'ll check again soon)'
      );
      return;
    }

    await ctx.api.editMessageText(
      ctx.chat!.id,
      ack.message_id,
      `✅ Tracking started!\n\n📦 ${scrapeResult.name ?? 'Tracked Product'}\n💰 Current price: ${formatCurrency(
        scrapeResult.price
      )}\n🔔 Alert threshold: 2% drop (change with /setalert)\n\nI'll notify you the moment the price falls 👇`,
      {
        reply_markup: new InlineKeyboard().url('🛒 Buy Now', created.affiliateUrl)
      }
    );
  } catch (error) {
    console.error('linkMessageHandler failed:', error);
    await ctx.reply('⚠️ Something went wrong while tracking this link. Please try again in a moment.');
  }
}
