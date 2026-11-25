
"""تحديث أسعار إغلاق أسهم البورصة المصرية من TradingView."""
import os
import sys
import json
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SB = {
    "apikey": KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type": "application/json"
}
CAIRO = ZoneInfo("Africa/Cairo")
SCAN = "https://scanner.tradingview.com/egypt/scan"


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(
        url, data=data, headers=headers or {}, method=method
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8")
        return json.loads(body) if body else None


def main():
    target = (
        os.environ.get("TARGET_DATE", "").strip()
        or datetime.now(CAIRO).date().isoformat()
    )
    print("تاريخ الجلسة:", target)

    stocks = http(
        SUPABASE + "/rest/v1/stocks?select=symbol&is_active=eq.true&limit=2000",
        headers=SB
    )
    known = {
        str(s["symbol"]).strip().upper(): s["symbol"]
        for s in stocks
    }
    print("الأسهم النشطة في Supabase:", len(known))

    payload = {
        "filter": [
            {"left": "type", "operation": "in_range", "right": ["stock"]}
        ],
        "columns": ["name", "close", "open", "high", "low", "volume", "time"],
        "range": [0, 1000],
        "sort": {"sortBy": "name", "sortOrder": "asc"},
    }

    res = http(
        SCAN,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    data = res.get("data", [])
    print("عدد الأسهم من TradingView:", len(data))

    if len(data) < 100:
        sys.exit("عدد الأسهم قليل جداً. لم يتم تعديل شيء.")

    rows, seen, wrong_date = [], set(), []

    for item in data:
        name, close, op, hi, lo, vol, ts = item["d"]
        sym = str(name).strip().upper()

        if sym not in known or close is None:
            continue

        trade_day = (
            datetime.fromtimestamp(
                int(ts), tz=ZoneInfo("UTC")
            ).astimezone(CAIRO).date().isoformat()
            if ts else None
        )

        if trade_day != target:
            wrong_date.append(sym)
            continue

        seen.add(sym)
        rows.append({
            "symbol": known[sym],
            "trade_date": target,
            "open": op,
            "high": hi,
            "low": lo,
            "close": close,
            "volume": int(vol) if vol is not None else None
        })

    missing = sorted(set(known) - seen)
    print("أسهم جاهزة للحفظ:", len(rows))
    print("أسهم بتاريخ مختلف:", len(wrong_date), wrong_date[:20])
    print("أسهم ليس لها سعر:", len(missing), missing)

    if not rows:
        print("لا توجد أسعار صالحة. لم يتم تعديل شيء.")
        return

    headers = dict(
        SB,
        Prefer="resolution=merge-duplicates,return=minimal"
    )
    url = SUPABASE + "/rest/v1/prices?on_conflict=symbol,trade_date"

    for i in range(0, len(rows), 200):
        http(
            url,
            data=json.dumps(rows[i:i + 200]).encode(),
            headers=headers,
            method="POST"
        )

    print("تم حفظ", len(rows), "سعر بتاريخ", target)


if __name__ == "__main__":
    main()
