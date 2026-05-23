import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type ScrapeResult = {
  name: string | null;
  price: number | null;
};

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, retryDelayMs = 3000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const networkError = !error?.response || ['ECONNABORTED', 'ENOTFOUND', 'ECONNRESET'].includes(error?.code);
      if (!networkError || attempt === retries) break;
      await delay(retryDelayMs);
    }
  }
  throw lastError;
}

async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  try {
    const response = await withRetry(() =>
      axios.get(url, {
        timeout: 15_000,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-IN,en;q=0.9'
        }
      })
    );

    const html = response.data as string;
    const $ = cheerio.load(html);

    const name =
      $('#productTitle').first().text().trim() ||
      $('meta[name="title"]').attr('content') ||
      $('title').first().text().trim() ||
      null;

    const priceRaw =
      $('#priceblock_dealprice').first().text().trim() ||
      $('#priceblock_ourprice').first().text().trim() ||
      $('.a-price .a-offscreen').first().text().trim() ||
      null;

    const price = parsePrice(priceRaw);
    if (name || price) return { name, price };

    const jsonLd = parseJsonLd(html);
    if (jsonLd.name || jsonLd.price) return jsonLd;

    return genericFallback(html);
  } catch (error: any) {
    console.warn('Amazon local scrape failed, falling back:', error?.message ?? 'Unknown error');
    return { name: null, price: null };
  }
}

async function scrapeFlipkart(url: string): Promise<ScrapeResult> {
  const response = await withRetry(() =>
    axios.get(url, {
      timeout: 15_000,
      headers: { 'User-Agent': USER_AGENT }
    })
  );

  const $ = cheerio.load(response.data);
  const priceText = $('._30jeq3._16Jk6d').first().text().trim();
  const nameText = $('.B_NuCI').first().text().trim();

  const primary = {
    name: nameText || null,
    price: parsePrice(priceText)
  };

  if (primary.name || primary.price) return primary;

  const html = response.data as string;
  const jsonLd = parseJsonLd(html);
  if (jsonLd.name || jsonLd.price) return jsonLd;

  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? null;
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() ?? '';
  const descPriceMatch = ogDescription.match(/Rs\.?\s*([\\d,]+(?:\\.\\d+)?)/i);
  const metaPick = { name: ogTitle, price: parsePrice(descPriceMatch?.[1] ?? null) };
  if (metaPick.name || metaPick.price) return metaPick;

  const scriptPriceMatches = [
    html.match(/"finalPrice"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1],
    html.match(/"sellingPrice"\s*:\s*\{\s*"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1],
    html.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*"priceCurrency"\s*:\s*"INR"/i)?.[1],
    html.match(/"currentPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1]
  ].filter(Boolean) as string[];

  for (const raw of scriptPriceMatches) {
    const parsed = parsePrice(raw);
    if (parsed != null) {
      return { name: ogTitle, price: parsed };
    }
  }

  return genericFallback(html);
}

function extractByPlatformSelectors(hostname: string, html: string): ScrapeResult {
  const $ = cheerio.load(html);

  if (hostname.includes('flipkart.com')) {
    const priceText =
      $('._30jeq3._16Jk6d').first().text().trim() ||
      $('._30jeq3').first().text().trim() ||
      $('div[class*="Nx9bqj"]').first().text().trim();
    const nameText = $('.B_NuCI').first().text().trim() || $('span[class*="VU-ZEz"]').first().text().trim();
    return { name: nameText || null, price: parsePrice(priceText) };
  }

  if (hostname.includes('ajio.com')) {
    const priceText =
      $('[itemprop="price"]').first().attr('content') ||
      $('span[class*="prod-sp"]').first().text().trim() ||
      $('div[class*="price"]').first().text().trim();
    const nameText =
      $('[itemprop="name"]').first().text().trim() ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim();
    return { name: nameText || null, price: parsePrice(priceText || null) };
  }

  if (hostname.includes('myntra.com')) {
    const priceText =
      $('span.pdp-price strong').first().text().trim() ||
      $('span[class*="pdp-price"]').first().text().trim() ||
      $('[itemprop="price"]').first().attr('content') ||
      null;
    const nameText =
      $('h1.pdp-title').first().text().trim() ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim();
    return { name: nameText || null, price: parsePrice(priceText) };
  }

  if (hostname.includes('meesho.com')) {
    const priceText =
      $('[itemprop="price"]').first().attr('content') ||
      $('h4[class*="sc"]').filter((_, el) => $(el).text().includes('₹')).first().text().trim() ||
      null;
    const nameText =
      $('[itemprop="name"]').first().text().trim() || $('h1').first().text().trim() || $('title').first().text().trim();
    return { name: nameText || null, price: parsePrice(priceText) };
  }

  if (hostname.includes('snapdeal.com')) {
    const priceText =
      $('span.payBlkBig').first().text().trim() ||
      $('[itemprop="price"]').first().attr('content') ||
      null;
    const nameText =
      $('h1[itemprop="name"]').first().text().trim() || $('h1').first().text().trim() || $('title').first().text().trim();
    return { name: nameText || null, price: parsePrice(priceText) };
  }

  return { name: null, price: null };
}

function parseJsonLd(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const script of scripts.toArray()) {
    try {
      const raw = $(script).contents().text();
      if (!raw) continue;
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (type === 'Product') {
          const offers = node?.offers;
          const priceValue = Array.isArray(offers) ? offers[0]?.price : offers?.price;
          return {
            name: node?.name ?? null,
            price: parsePrice(priceValue != null ? String(priceValue) : null)
          };
        }
      }
    } catch {
      continue;
    }
  }

  return { name: null, price: null };
}

function genericFallback(html: string): ScrapeResult {
  const text = cheerio.load(html).text();
  const priceMatch = text.match(/[₹Rs\.]*\s*([\d,]+(?:\.\d+)?)/i);
  return {
    name: null,
    price: parsePrice(priceMatch?.[1] ?? null)
  };
}

async function pythonFallbackScrape(url: string): Promise<ScrapeResult> {
  const pythonBinaries = ['python3.12', 'python3.11', 'python3.10', 'python3'];

  try {
    for (const py of pythonBinaries) {
      try {
        const { stdout } = await execFileAsync(py, ['scripts/python_fallback_scraper.py', url], {
          timeout: 20_000
        });
        const parsed = JSON.parse(stdout.trim());
        return {
          name: typeof parsed?.name === 'string' ? parsed.name : null,
          price: typeof parsed?.price === 'number' ? parsed.price : null
        };
      } catch {
        continue;
      }
    }
    console.warn('Python fallback scrape failed: no working Python runtime found');
    return { name: null, price: null };
  } catch (error) {
    console.warn('Python fallback scrape failed:', (error as Error).message);
    return { name: null, price: null };
  }
}

export async function scrapeProductPrice(url: string): Promise<ScrapeResult> {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('amazon.in') || hostname.includes('amazon.com')) {
      return await scrapeAmazon(url);
    }

    if (hostname.includes('flipkart.com')) {
      return await scrapeFlipkart(url);
    }

    const response = await withRetry(() =>
      axios.get(url, {
        timeout: 15_000,
        headers: { 'User-Agent': USER_AGENT }
      })
    );

    const html = response.data as string;
    const platformPick = extractByPlatformSelectors(hostname, html);
    if (platformPick.name || platformPick.price) return platformPick;

    const jsonLd = parseJsonLd(html);
    if (jsonLd.name || jsonLd.price) return jsonLd;

    const generic = genericFallback(html);
    if (generic.name || generic.price) return generic;

    return await pythonFallbackScrape(url);
  } catch (error) {
    console.warn('Price scraping failed:', (error as Error).message);
    return await pythonFallbackScrape(url);
  }
}
