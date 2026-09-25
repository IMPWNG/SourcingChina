"""Crawl one supplier site with Scrapling and print page HTML as JSON."""

import json
import re
import sys
from urllib.parse import urljoin, urlparse

from scrapling.fetchers import FetcherSession
from scrapling.parser import Selector

PREFER = re.compile(r"h-col-|sys-pr|/products?", re.I)
JS_KEY = re.compile(r'document\.cookie="(jsKey=[^;"]+)')
MAX_HTML = 500_000


def host_of(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def candidates(url: str) -> list[str]:
    parsed = urlparse(url)
    host = parsed.netloc
    hosts = [host, host[4:]] if host.lower().startswith("www.") else [host, f"www.{host}"]
    protocols = ["http", "https"] if parsed.scheme == "http" else ["https", "http"]
    out: list[str] = []
    for next_host in hosts:
        for protocol in protocols:
            next_url = parsed._replace(scheme=protocol, netloc=next_host).geturl()
            if next_url not in out:
                out.append(next_url)
    return out


def page_html(page) -> str:
    raw = getattr(page, "html_content", None)
    if raw is None:
        body = getattr(page, "body", b"")
        raw = body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else str(body)
    return str(raw)[:MAX_HTML]


def read_page(session, url: str, timeout: float):
    last_error = None
    for candidate in candidates(url):
        try:
            page = session.get(candidate, timeout=timeout, impersonate="chrome", stealthy_headers=True)
            html = page_html(page)
            match = JS_KEY.search(html)
            if match:
                key, value = match.group(1).split("=", 1)
                page = session.get(
                    candidate,
                    timeout=timeout,
                    impersonate="chrome",
                    stealthy_headers=True,
                    cookies={key: value},
                )
                html = page_html(page)
            status = int(getattr(page, "status", 0) or 0)
            final = str(getattr(page, "url", None) or candidate)
            if 200 <= status < 400:
                return status, final, html
        except Exception as error:
            last_error = error
            continue
    if last_error:
        raise last_error
    return 0, url, ""


def links_from(html: str, final_url: str, origin: str, depth: int):
    page = Selector(html)
    product, other = [], []
    for href in page.css("a::attr(href)").getall():
        try:
            url = urljoin(final_url, href)
        except ValueError:
            continue
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or host_of(url) != origin:
            continue
        clean = parsed._replace(fragment="").geturl()
        item = {"url": clean, "depth": depth}
        if PREFER.search(parsed.path + "?" + parsed.query):
            product.append(item)
        else:
            other.append(item)
    return product[:8], other[:6]


def crawl(spec: dict) -> dict:
    start = spec["start"]
    max_pages = int(spec.get("max_pages") or 8)
    max_depth = int(spec.get("max_depth") or 2)
    timeout = float(spec.get("timeout") or 8)
    origin = host_of(start)
    pages = []
    seen = set()
    queue = [{"url": start, "depth": 0}]
    with FetcherSession(impersonate="chrome", stealthy_headers=True, timeout=timeout) as session:
        while queue and len(pages) < max_pages:
            item = queue.pop(0)
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            try:
                status, final, html = read_page(session, item["url"], timeout)
            except Exception:
                continue
            if status < 200 or status >= 400 or host_of(final) != origin:
                continue
            if 'document.cookie="jsKey=' in html:
                continue
            pages.append({"url": final, "status": status, "html": html})
            if item["depth"] >= max_depth:
                continue
            product, other = links_from(html, final, origin, item["depth"] + 1)
            for link in reversed(product):
                if link["url"] not in seen:
                    queue.insert(0, link)
            for link in other:
                if link["url"] not in seen:
                    queue.append(link)
    return {"pages": pages, "error": None}


def main() -> None:
    spec = json.loads(sys.stdin.read() or "{}")
    try:
        json.dump(crawl(spec), sys.stdout, ensure_ascii=False)
    except Exception as error:
        json.dump({"pages": [], "error": str(error)[:180]}, sys.stdout)


if __name__ == "__main__":
    main()
