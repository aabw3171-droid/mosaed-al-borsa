
import os
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE = "https://api.datacedar.com/v3"
SUPABASE = os.environ["SUPABASE_URL"].rstrip"/")
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
    "Prefer": "resolution=merge-duplicates,return=minimal"
}

def dc_get(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    return get(url, dc_headers)

def sb_get(path):
    return get(SUPABASE + "/rest/v1/" + path, sb_headers)

def sb_post(rows):
    url = SUPABASE + "/rest/v1/prices?on_conflict=symbol,trade_date"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode("utf-8"),
        headers=sb_headers,
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status

def main():
    # قراءة الأسهم الموجودة بالفعل في الموقع
    stocks = sb_get("stocks?select=symbol,name&limit=1000")
    known = {
        str(s["symbol"]).strip().upper(): s["symbol"]
        for s in stocks
    }

    # جلب قائمة أسهم EGX من DataCedar
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
        raise RuntimeError("لم يتم العثور على رموز EGX مطابقة لجدول stocks")

    # آخر 7 أيام تقويمية لضمان التقاط آخر جلسة
    today = datetime.now(ZoneInfo("Africa/Cairo")).date()
    start = (today - timedelta(days=7)).isoformat()
    end = today.isoformat()

    saved = 0
    all_rows = []

    # الخطة المجانية تسمح بثلاثة رموز في الطلب
    for i in range(0, len(matched), 3):
        batch = matched[i:i + 3]
        symbols = ",".join(x[0] for x in batch)

        result = dc_get("/stocks/bars", {
            "symbols": symbols,
            "timeframe": "1d",
            "from": start,
            "to": end,
            "adjustment": "raw",
            "order": "asc"
        })

        data = result.get("data", {})

        for sid, site_symbol in batch:
            for bar in data.get(sid, []):
                dt = datetime.fromtimestamp(
                    int(bar["ts_ms"]) / 1000,
                    tz=ZoneInfo("UTC")
                ).astimezone(ZoneInfo("Africa/Cairo")).date()

                all_rows.append({
                    "symbol": site_symbol,
                    "trade_date": dt.isoformat(),
                    "open": bar.get("open"),
                    "high": bar.get("high"),
                    "low": bar.get("low"),
                    "close": bar.get("close"),
                    "volume": int(float(bar["volume"]))
                    if bar.get("volume") is not None else None
                })

        time.sleep(1.1)

    if not all_rows:
        raise RuntimeError("DataCedar لم يرجع أي أسعار خلال الفترة المحددة")

    # حفظ الأسعار في Supabase على دفعات
    for i in range(0, len(all_rows), 200):
        part = all_rows[i:i + 200]
        sb_post(part)
        saved += len(part)

    print("تم تحديث الأسعار بنجاح")
    print("الأسهم المطابقة:", len(matched))
    print("عدد سجلات الأسعار:", saved)

if __name__ == "__main__":
    main()
