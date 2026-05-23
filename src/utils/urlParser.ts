const URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
const URL_FALLBACK_REGEX = /\b(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.(?:in|com|net|org|io|it|link)\b(?:[^\s<>"'`]*)/gi;

const SUPPORTED_DOMAINS = [
  'amazon.in',
  'amazon.com',
  'flipkart.com',
  'meesho.com',
  'myntra.com',
  'ajio.com',
  'snapdeal.com',
  'fkrt.it',
  'dl.flipkart.com',
  'ajiio.in',
  'ajio.page.link',
  'myntr.it'
];

export function extractFirstUrl(text: string): string | null {
  const normalizedText = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const strictMatches = normalizedText.match(URL_REGEX);
  if (strictMatches?.[0]) return sanitizeUrl(strictMatches[0]);

  const fallbackMatches = normalizedText.match(URL_FALLBACK_REGEX);
  if (!fallbackMatches?.[0]) return null;

  const raw = sanitizeUrl(fallbackMatches[0]);
  if (/^https?:\/\//i.test(raw)) return raw;
  return sanitizeUrl(`https://${raw}`);
}

function sanitizeUrl(input: string): string {
  return input
    .trim()
    .replace(/[)\],.!?]+$/g, '')
    .replace(/^<|>$/g, '');
}

export function isSupportedPlatform(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SUPPORTED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function detectPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (hostname.includes('amazon.')) return 'Amazon';
    if (hostname.includes('flipkart.')) return 'Flipkart';
    if (hostname.includes('meesho.')) return 'Meesho';
    if (hostname.includes('myntra.')) return 'Myntra';
    if (hostname.includes('ajio.')) return 'AJIO';
    if (hostname.includes('snapdeal.')) return 'Snapdeal';
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host.includes('amazon.')) {
      const dpMatch = parsed.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      const gpMatch = parsed.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      const asin = dpMatch?.[1] ?? gpMatch?.[1];
      if (asin) return `${parsed.protocol}//${host}/dp/${asin.toUpperCase()}`;
    }

    if (host.includes('flipkart.')) {
      const pid = parsed.searchParams.get('pid');
      if (pid) return `${parsed.protocol}//${host}${parsed.pathname}?pid=${pid}`;
    }

    parsed.search = '';
    return `${parsed.protocol}//${host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function canonicalizeAmazonProductUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('amazon.')) return url;

    const dpMatch = parsed.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
    const gpMatch = parsed.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    const pdRdI = parsed.searchParams.get('pd_rd_i');
    const asinFromQuery = pdRdI && /^[A-Z0-9]{10}$/i.test(pdRdI) ? pdRdI : null;

    const asin = dpMatch?.[1] ?? gpMatch?.[1] ?? asinFromQuery;
    if (!asin) return null;

    return `${parsed.protocol}//${host}/dp/${asin.toUpperCase()}`;
  } catch {
    return null;
  }
}
