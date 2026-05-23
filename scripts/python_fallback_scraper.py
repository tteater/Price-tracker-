#!/usr/bin/env python3
import json
import re
import sys
from typing import Optional, Tuple

import requests
from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests
from scrapling import Selector

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def parse_price(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    cleaned = re.sub(r"[^\d.,]", "", text).replace(",", "")
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def extract_json_ld_product(soup: BeautifulSoup) -> Tuple[Optional[str], Optional[float]]:
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for script in scripts:
        try:
            raw = script.string or script.get_text() or ""
            if not raw.strip():
                continue
            data = json.loads(raw)
            nodes = data if isinstance(data, list) else [data]
            for node in nodes:
                if isinstance(node, dict) and node.get("@type") == "Product":
                    name = node.get("name")
                    offers = node.get("offers")
                    if isinstance(offers, list):
                        price = parse_price(str((offers[0] or {}).get("price", "")))
                    elif isinstance(offers, dict):
                        price = parse_price(str(offers.get("price", "")))
                    else:
                        price = None
                    return name, price
        except Exception:
            continue
    return None, None


def scrape(url: str) -> dict:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9"}
    host = ""
    try:
        host = re.sub(r"^www\\.", "", requests.utils.urlparse(url).hostname or "").lower()
    except Exception:
        pass

    try:
        if "ajio.com" in host:
            resp = curl_requests.get(url, headers=headers, timeout=20, impersonate="chrome124")
        else:
            resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception:
        return {"name": None, "price": None}

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")
    selector = Selector(html)

    name = None
    price = None

    if "flipkart.com" in host:
        name_el = soup.select_one(".B_NuCI")
        price_el = soup.select_one("._30jeq3._16Jk6d") or soup.select_one("._30jeq3") or soup.select_one("div[class*='Nx9bqj']")
        name = name_el.get_text(strip=True) if name_el else None
        price = parse_price(price_el.get_text(strip=True) if price_el else None)

    if "amazon." in host and (not name or price is None):
        name = (
            selector.css("#productTitle::text").get()
            or selector.css("meta[name='title']::attr(content)").get()
            or selector.css("title::text").get()
            or name
        )
        amazon_price = (
            selector.css("#priceblock_dealprice::text").get()
            or selector.css("#priceblock_ourprice::text").get()
            or selector.css(".a-price .a-offscreen::text").get()
        )
        if price is None:
            price = parse_price(amazon_price)

    if "ajio.com" in host and (not name or price is None):
        name = (
            selector.css("[itemprop='name']::text").get()
            or selector.css("h1::text").get()
            or selector.css("title::text").get()
            or name
        )
        ajio_price = (
            selector.css("[itemprop='price']::attr(content)").get()
            or selector.css("span[class*='prod-sp']::text").get()
            or selector.css("div[class*='price']::text").get()
        )
        if price is None:
            price = parse_price(ajio_price)

    if "myntra.com" in host and (not name or price is None):
        name = (
            selector.css("h1.pdp-title::text").get()
            or selector.css("h1::text").get()
            or selector.css("title::text").get()
            or name
        )
        myntra_price = (
            selector.css("span.pdp-price strong::text").get()
            or selector.css("span[class*='pdp-price']::text").get()
            or selector.css("[itemprop='price']::attr(content)").get()
        )
        if price is None:
            price = parse_price(myntra_price)

    if "meesho.com" in host and (not name or price is None):
        name = (
            selector.css("[itemprop='name']::text").get()
            or selector.css("h1::text").get()
            or selector.css("title::text").get()
            or name
        )
        meesho_price = (
            selector.css("[itemprop='price']::attr(content)").get()
            or selector.css("h4::text").get()
        )
        if price is None:
            price = parse_price(meesho_price)

    if "snapdeal.com" in host and (not name or price is None):
        name = (
            selector.css("h1[itemprop='name']::text").get()
            or selector.css("h1::text").get()
            or selector.css("title::text").get()
            or name
        )
        snapdeal_price = (
            selector.css("span.payBlkBig::text").get()
            or selector.css("[itemprop='price']::attr(content)").get()
        )
        if price is None:
            price = parse_price(snapdeal_price)

    if not name or price is None:
        j_name, j_price = extract_json_ld_product(soup)
        name = name or j_name
        if price is None:
            price = j_price

    if price is None:
        text = soup.get_text(" ", strip=True)
        match = re.search(r"(?:₹|Rs\\.?)\\s*([\\d,]+(?:\\.\\d+)?)", text, re.IGNORECASE)
        if match:
            price = parse_price(match.group(1))

    return {"name": name, "price": price}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"name": None, "price": None}))
        sys.exit(0)

    result = scrape(sys.argv[1])
    print(json.dumps(result))
