
import os
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime, date
from zoneinfo import ZoneInfo

BASE = "https://api.datacedar.com/v3"
SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
DC_KEY = os.environ["DATACEDAR_API_KEY"]
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


dc_headers = {
    "X-API-Key": DC_KEY,
    "Accept": "application/json"
}

sb_headers = {
    "apikey": SB_KEY,
    "Authorization": "Bearer " + SB_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}


def dc_get(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    return get(url, dc_headers)


def sb_get(path):
    return get(SUPABASE + "/rest/v1/" + path, sb_headers)


def sb_insert(rows):
    url = SUPABASE + "/rest/v1/prices"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode("utf-8"),
        headers=sb_headers,
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main():
    target_text = os.environ.get("TARGET_DATE", "").strip()

    if target_text:
        target_date = date.fromisoformat(target_text)
    else:
        target_date = datetime.now(
            ZoneInfo("Africa/Cairo")
        ).date()

    target = target_date.isoformat()

    stocks = sb_get(
        "stocks?select=symbol,name&is_active=eq.true&limit=1000"
    )

    known = {
        str(s["symbol"]).strip().upper(): s["symbol"]
        for s in stocks
    }

    assets = []
    cursor = None

    while True:
        params = {"limit": 1000}

        if cursor:
            params["cursor"] = cursor

        result = dc_get("/exchanges/egx/symbols", params)
        assets.extend(result.get("data", []))

        page = result.get("pagination", {})

        if not page.get("has_more"):
            break

        cursor = page.get("next_cursor")

        if not cursor:
            break

    matched = []

    for asset in assets:
        ticker = str(asset.get("symbol", "")).strip().upper()
        sid = asset.get("sid")

        if ticker in known and sid:
            matched.append((sid, known[ticker]))

    if not matched:
        raise RuntimeError(
            "لم يتم العثور على رموز EGX مطابقة لجدول stocks"
        )

    existing = sb_get(
        "prices?select=symbol&trade_date=eq."
        + urllib.parse.quote(target, safe="")
        + "&limit=2000"
    )

    existing_symbols = {
        str(row["symbol"]) for row in existing
    }

    missing = [
        (sid, symbol)
        for sid, symbol in matched
        if symbol not in existing_symbols
    ]

    print("تاريخ الجلسة المطلوب:", target)
    print("السجلات الموجودة والمحميّة:", len(existing_symbols))
    print("الأسهم المطابقة:", len(matched))
    print("الأسهم الجديدة فقط:", len(missing))

    if not missing:
        print("لا توجد سجلات جديدة. لم يتم تعديل أي سعر موجود.")
        return

    all_rows = []

    for i in range(0, len(missing), 3):
        batch = missing[i:i + 3]
        symbols = ",".join(x[0] for x in batch)

        result = dc_get("/stocks/bars", {
            "symbols": symbols,
            "timeframe": "1d",
            "from": target,
            "to": target,
            "adjustment": "raw",
            "order": "asc"
        })

        data = result.get("data", {})

        for sid, site_symbol in batch:
            for bar in data.get(sid, []):
                dt = datetime.fromtimestamp(
                    int(bar["ts_ms"]) / 1000,
                    tz=ZoneInfo("UTC")
                ).astimezone(
                    ZoneInfo("Africa/Cairo")
                ).date().isoformat()

                if dt != target:
                    continue

                close = bar.get("close")

                if close is None:
                    continue

                all_rows.append({
                    "symbol": site_symbol,
                    "trade_date": target,
                    "open": bar.get("open"),
                    "high": bar.get("high"),
                    "low": bar.get("low"),
                    "close": close,
                    "volume": int(float(bar["volume"]))
                    if bar.get("volume") is not None else None
                })

        time.sleep(1.1)

    all_rows = [
        row for row in all_rows
        if row["symbol"] not in existing_symbols
    ]

    if not all_rows:
        print("لم يرجع DataCedar أسعارًا جديدة لهذا التاريخ.")
        return

    inserted = 0

    for i in range(0, len(all_rows), 200):
        part = all_rows[i:i + 200]
        sb_insert(part)
        inserted += len(part)

    print("اكتملت الإضافة دون استبدال الأسعار الموجودة.")
    print("تاريخ الجلسة:", target)
    print("عدد السجلات المضافة:", inserted)
    print("السجلات الموجودة التي لم تُمس:", len(existing_symbols))


if __name__ == "__main__":
    main()
