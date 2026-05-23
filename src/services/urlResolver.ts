import axios from 'axios';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function resolveFinalUrl(inputUrl: string): Promise<string> {
  try {
    const response = await axios.get(inputUrl, {
      timeout: 12_000,
      maxRedirects: 10,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-IN,en;q=0.9'
      },
      validateStatus: () => true
    });

    const finalUrl = response.request?.res?.responseUrl;
    if (typeof finalUrl === 'string' && finalUrl.startsWith('http')) {
      return finalUrl;
    }

    return inputUrl;
  } catch {
    return inputUrl;
  }
}
