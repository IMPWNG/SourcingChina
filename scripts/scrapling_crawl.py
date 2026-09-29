"""Crawl one supplier site with Scrapling and print page HTML as JSON."""

import json
import re
import sys
from urllib.parse import parse_qs, urljoin, urlparse

from scrapling.fetchers import FetcherSession
from scrapling.parser import Selector

PREFER = re.compile(
    r"h-col-|sys-p[rd]|m5page=|jpt=|/products?|/product|/goods|/item|/detail|/shop|/store|/collection|/categor|/catalog|/pd[/-]|contact|about|factory|certif|helmet|whatsapp|wechat|联系|产品|商品|系列|关于|工厂|资质",
    re.I,
)
SKIP = re.compile(
    r"\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|css|js|xml)(\?|$)|/cart|/login|/signin|/wp-admin|/cdn-cgi|sitemap",
    re.I,
)
JS_KEY = re.compile(r'document\.cookie="(jsKey=[^;"]+)')
LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
TOTAL_PAGES = re.compile(r"total\s+(\d+)\s+pages|共\s*(\d+)\s*页", re.I)
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


def links_from(html: str, final_url: str, origin: str, depth: int, prefer_exact: set[str]):
    page = Selector(html)
    product, other = [], []
    seen_local: set[str] = set()
    for node in page.css("a"):
        href = node.attrib.get("href") or ""
        label = (node.text or "").strip()
        try:
            url = urljoin(final_url, href)
        except ValueError:
            continue
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or host_of(url) != origin:
            continue
        clean = parsed._replace(fragment="").geturl()
        if clean in seen_local or SKIP.search(clean):
            continue
        seen_local.add(clean)
        item = {"url": clean, "depth": depth}
        blob = f"{parsed.path}?{parsed.query} {label}"
        if PREFER.search(blob) or clean in prefer_exact:
            product.append(item)
        else:
            other.append(item)
    return product[:80], other[:8]


def catalog_urls(html: str, current: str) -> list[str]:
    parsed = urlparse(current)
    root = f"{parsed.scheme}://{parsed.netloc}"
    found: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        clean = urlparse(url)._replace(fragment="").geturl()
        if clean in seen or SKIP.search(clean):
            return
        seen.add(clean)
        found.append(clean)

    for gid in re.findall(r"sys-pr/\?g=(\d+)", html, re.I):
        add(f"{root}/sys-pr/?g={gid}")
    for gid in re.findall(r'<input[^>]*\bvalue=["\'](\d+)["\'][^>]*>', html, re.I):
        add(f"{root}/sys-pr/?g={gid}")
    for col in re.findall(r"h-col-(\d+)\.html", html, re.I):
        add(f"{root}/h-col-{col}.html")
    g = (parse_qs(parsed.query).get("g") or [None])[0]
    total = TOTAL_PAGES.search(html)
    if g and total:
        n = int(total.group(1) or total.group(2) or "1")
        for page in range(2, min(n, 30) + 1):
            add(f"{root}/sys-pr/?g={g}&m5page={page}")
    for href in re.findall(r"""href=["']([^"']*m5page=\d+[^"']*)["']""", html, re.I):
        joined = urljoin(current, href.replace("&amp;", "&"))
        page = re.search(r"m5page=(\d+)", joined)
        if g and page and "sys-pr" not in joined:
            add(f"{root}/sys-pr/?g={g}&m5page={page.group(1)}")
        else:
            add(joined)
    return found


def sitemap_urls(session, start: str, origin: str, timeout: float) -> list[str]:
    parsed = urlparse(start)
    root = f"{parsed.scheme}://{parsed.netloc}"
    found: list[str] = []
    for path in ("/sitemap.xml", "/sitemap_index.xml"):
        try:
            status, _final, html = read_page(session, f"{root}{path}", timeout)
        except Exception:
            continue
        if status < 200 or status >= 400 or "<loc>" not in html.lower():
            continue
        for loc in LOC.findall(html):
            if host_of(loc) != origin or SKIP.search(loc):
                continue
            if loc not in found:
                found.append(loc)
        if found:
            break
    product = [url for url in found if PREFER.search(url)]
    other = [url for url in found if url not in product]
    return (product + other)[:80]


def crawl(spec: dict) -> dict:
    start = spec["start"]
    max_pages = int(spec.get("max_pages") or 80)
    max_depth = int(spec.get("max_depth") or 4)
    timeout = float(spec.get("timeout") or 8)
    origin = host_of(start)
    prefer_exact = {url for url in (spec.get("seeds") or []) if isinstance(url, str) and host_of(url) == origin}
    pages = []
    seen = set()
    queued = {start}
    queue = [{"url": start, "depth": 0}]
    for seed in prefer_exact:
        if seed not in queued:
            queue.append({"url": seed, "depth": 0})
            queued.add(seed)
    with FetcherSession(impersonate="chrome", stealthy_headers=True, timeout=timeout) as session:
        for loc in sitemap_urls(session, start, origin, timeout):
            if loc not in queued:
                queue.append({"url": loc, "depth": 1})
                queued.add(loc)
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
            for url in catalog_urls(html, final):
                if url not in seen and url not in queued:
                    queue.insert(0, {"url": url, "depth": 1})
                    queued.add(url)
            if item["depth"] >= max_depth:
                continue
            product, other = links_from(html, final, origin, item["depth"] + 1, prefer_exact)
            for link in reversed(product):
                if link["url"] not in seen and link["url"] not in queued:
                    queue.insert(0, link)
                    queued.add(link["url"])
            for link in other:
                if link["url"] not in seen and link["url"] not in queued:
                    queue.append(link)
                    queued.add(link["url"])
    return {"pages": pages, "error": None}


def _self_check() -> None:
    html = (
        '<a href="/sys-pr/?g=12">Half Face</a>'
        '<input type="radio" value="14">'
        '<a href="/h-col-125.html">Products</a>'
        "total 2 pages"
        '<a href="/?m5page=2">2</a>'
    )
    urls = catalog_urls(html, "https://www.rng-helmets.com/sys-pr/?g=12")
    assert "https://www.rng-helmets.com/sys-pr/?g=12" in urls
    assert "https://www.rng-helmets.com/sys-pr/?g=14" in urls
    assert "https://www.rng-helmets.com/h-col-125.html" in urls
    assert "https://www.rng-helmets.com/sys-pr/?g=12&m5page=2" in urls


def main() -> None:
    spec = json.loads(sys.stdin.read() or "{}")
    if spec.get("self_check"):
        _self_check()
        json.dump({"ok": True}, sys.stdout)
        return
    try:
        json.dump(crawl(spec), sys.stdout, ensure_ascii=False)
    except Exception as error:
        json.dump({"pages": [], "error": str(error)[:180]}, sys.stdout)


if __name__ == "__main__":
    main()
