
import os
import time
import requests
from datetime import date, timedelta
from urllib.parse import quote

KEY = os.environ.get("DATACEDAR_KEY")
BASE = "https://api.datacedar.com/v3"
HEADERS = {"X-API-Key": KEY, "Accept": "application/json"}

def get(path, params=None):
    response = requests.get(
        BASE + path,
        headers=HEADERS,
        params=params,
        timeout=30
    )
    print(f"\nGET {response.url}")
    print("HTTP:", response.status_code)

    try:
        body = response.json()
    except Exception:
        print(response.text[:1000])
        return None

    if response.status_code != 200:
        print("API ERROR:", body.get("error", body))
        return None

    return body

def show_bars(sid, label):
    time.sleep(1)
    encoded_sid = quote(sid, safe=":")
    start = (date.today() - timedelta(days=365)).isoformat()

    result = get(
        f"/stocks/{encoded_sid}/bars",
        {
            "timeframe": "1d",
            "from": start,
            "order": "asc",
            "limit": 500
        }
    )

    if not result:
        return

    bars = result.get("data", [])
    print(f"\n--- {label} ---")
    print("SID:", result.get("meta", {}).get("sid", sid))
    print("عدد الجلسات:", len(bars))

    if bars:
        first = bars[0]
        last = bars[-1]
        print("أول جلسة:", first.get("ts_ms"))
        print("آخر جلسة:", last.get("ts_ms"))
        print("آخر سعر:")
        print({
            "open": last.get("open"),
            "high": last.get("high"),
            "low": last.get("low"),
            "close": last.get("close"),
            "volume": last.get("volume")
        })
    else:
        print("لا توجد بيانات في الفترة المطلوبة.")

def main():
    if not KEY:
        print("ERROR: DATACEDAR_KEY غير موجود.")
        return

    print("اختبار اتصال DataCedar")

    exchanges = get("/exchanges", {"country": "EG"})
    if exchanges:
        for item in exchanges.get("data", []):
            if str(item.get("code", "")).lower() == "egx":
                print("EGX exchange:", item)
                break

    time.sleep(1)
    search = get("/search", {"q": "EGX30", "exchange": "egx"})

    if search:
        print("\nنتائج البحث عن EGX30:")
        print(search.get("data"))

        items = search.get("data", [])
        if isinstance(items, list):
            for item in items:
                sid = item.get("sid")
                if sid:
                    show_bars(sid, "EGX30")
                    break

    # اختبار سهم EGX معروف في دليل DataCedar
    show_bars("egx:EGS01041C010", "اختبار سهم EGX")

if __name__ == "__main__":
    main()
