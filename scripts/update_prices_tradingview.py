
"""تحديث أسعار إغلاق أسهم ومؤشر البورصة المصرية من TradingView."""
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
UTC = ZoneInfo("UTC")
SCAN = "https://scanner.tradingview.com/egypt/scan"


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(
        url, data=data, headers=headers or {}, method=method
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8")
        return json.loads(body) if body else None


def scan_tradingview(asset_type):
    payload = {
        "filter": [
            {
                "left": "type",
                "operation": "in_range",
                "right": [asset_type]
            }
        ],
        "columns": [
            "name", "close", "open", "high",
            "low", "volume", "time"
        ],
        "range": [0, 1000],
        "sort": {
            "sortBy": "name",
            "sortOrder": "asc"
        }
    }

    result = http(
        SCAN,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    return result.get("data", [])


def get_trade_day(timestamp):
    if not timestamp:
        return None

    return (
        datetime.fromtimestamp(
            int(timestamp), tz=UTC
        ).astimezone(CAIRO).date().isoformat()
    )


def main():
    target = (
        os.environ.get("TARGET_DATE", "").strip()
        or datetime.now(CAIRO).date().isoformat()
    )

    print("تاريخ الجلسة:", target)

    stocks = http(
        SUPABASE + "/rest/v1/stocks"
        "?select=symbol&is_active=eq.true&limit=2000",
        headers=SB
    )

    known = {
        str(s["symbol"]).strip().upper(): s["symbol"]
        for s in stocks
    }

    print("الأسهم النشطة في Supabase:", len(known))

    # جلب الأسهم
    data = scan_tradingview("stock")
    print("عدد الأسهم من TradingView:", len(data))

    if len(data) < 100:
        sys.exit("عدد الأسهم قليل جداً. لم يتم تعديل شيء.")

    rows = []
    seen = set()
    wrong_date = []

    for item in data:
        values = item.get("d", [])

        if len(values) < 7:
            continue

        name, close, op, hi, lo, vol, ts = values
        sym = str(name).strip().upper()

        if sym not in known or close is None:
            continue

        trade_day = get_trade_day(ts)

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

    # جلب EGX30 بطلب مستقل
    index_row = None

    try:
        index_data = scan_tradingview("index")
        print("عدد المؤشرات من TradingView:", len(index_data))

        for item in index_data:
            values = item.get("d", [])

            if len(values) < 7:
                continue

            name, close, op, hi, lo, vol, ts = values
            symbol = str(name).strip().upper()

            if symbol not in ("EGX30", "EGX:EGX30"):
                continue

            trade_day = get_trade_day(ts)

            print(
                "تم العثور على EGX30:",
                symbol,
                "الإغلاق:", close,
                "التاريخ:", trade_day
            )

            if close is None or trade_day != target:
                print("بيانات المؤشر غير صالحة أو بتاريخ مختلف.")
                break

            db_symbol = known.get("EGX30")

            if not db_symbol:
                print("EGX30 غير موجود ضمن الأسهم النشطة في Supabase.")
                break

            index_row = {
                "symbol": db_symbol,
                "trade_date": target,
                "open": op,
                "high": hi,
                "low": lo,
                "close": close,
                "volume": int(vol) if vol is not None else None
            }
            break

        if index_row is None:
            print("لم يتم تأكيد سعر EGX30 من TradingView.")

    except Exception as e:
        print("تعذر جلب المؤشر:", str(e))
        print("لن يتم حفظ سعر للمؤشر.")

    # حفظ الأسعار الصالحة فقط
    all_rows = rows[:]

    if index_row:
        all_rows.append(index_row)

    if not all_rows:
        print("لا توجد أسعار صالحة. لم يتم تعديل شيء.")
        return

    headers = dict(
        SB,
        Prefer="resolution=merge-duplicates,return=minimal"
    )

    url = (
        SUPABASE
        + "/rest/v1/prices?on_conflict=symbol,trade_date"
    )

    for i in range(0, len(all_rows), 200):
        http(
            url,
            data=json.dumps(all_rows[i:i + 200]).encode(),
            headers=headers,
            method="POST"
        )

    print("تم حفظ", len(rows), "سعر سهم بتاريخ", target)

    if index_row:
        print("تم حفظ سعر EGX30 من TradingView.")
    else:
        print("لم يتم حفظ EGX30 لعدم تأكيد بياناته.")


if __name__ == "__main__":
    main()
