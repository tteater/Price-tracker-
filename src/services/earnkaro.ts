import axios from 'axios';

export async function convertToAffiliateLink(originalUrl: string): Promise<string> {
  const token = process.env.EARNKARO_API_KEY;
  if (!token) {
    console.warn('EARNKARO_API_KEY missing, using original URL');
    return originalUrl;
  }

  const attemptV3 = axios.post(
    'https://api.earnkaro.com/api/v3/link-generate',
    { url: originalUrl },
    {
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const attemptConverter = axios.post(
    'https://ekaro-api.affiliaters.in/api/converter/public',
    {
      deal: originalUrl,
      convert_option: 'convert_only'
    },
    {
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  try {
    const response = await attemptV3;
    const data = response.data ?? {};
    return (
      data?.data?.short_link ??
      data?.data?.affiliate_link ??
      data?.short_link ??
      data?.affiliate_link ??
      originalUrl
    );
  } catch (error: any) {
    const status = error?.response?.status;

    if (status === 401) {
      console.warn('Invalid EarnKaro API key');
      return originalUrl;
    }

    if (status === 400) {
      console.warn(`URL not supported by EarnKaro: ${originalUrl}`);
      return originalUrl;
    }

    if (error?.code === 'ECONNABORTED' || error?.message?.toLowerCase?.().includes('timeout')) {
      console.warn('EarnKaro timeout, using original URL');
      return originalUrl;
    }

    try {
      const fallback = await attemptConverter;
      const data = fallback.data ?? {};
      if (data?.success && typeof data?.data === 'string' && data.data.length > 0) {
        const urlMatch = data.data.match(/https?:\/\/\S+/i);
        return urlMatch?.[0] ?? originalUrl;
      }
      return originalUrl;
    } catch (fallbackError: any) {
      const fallbackStatus = fallbackError?.response?.status;
      if (fallbackStatus === 401) {
        console.warn('Invalid EarnKaro API key');
      } else if (fallbackStatus === 400) {
        console.warn(`URL not supported by EarnKaro: ${originalUrl}`);
      } else if (
        fallbackError?.code === 'ECONNABORTED' ||
        fallbackError?.message?.toLowerCase?.().includes('timeout')
      ) {
        console.warn('EarnKaro timeout, using original URL');
      } else {
        console.warn('EarnKaro conversion failed, using original URL');
      }
      return originalUrl;
    }
  }
}
