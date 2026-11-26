
import os
import time
from urllib.parse import quote
from datetime import datetime, timedelta, timezone

import requests

KEY = os.environ.get("DATACEDAR_KEY")
DC = "https://api.datacedar.com/v3"
HEADERS = {"X-API-Key": KEY, "Accept": "application/json"}


def test_datacedar(sid):
    print("\n===== DATACEDAR:", sid, "=====")
    url = f"{DC}/stocks/{quote(sid, safe=':')}/bars"
    params = {
        "timeframe": "1Day",
        "adjustment": "all",
        "limit": 50000
    }
    try:
        r = requests.get(url, headers=HEADERS,
                         params=params, timeout=40)
        print("HTTP:", r.status_code)
        body = r.json()
        print("META:", body.get("meta"))
        bars = body.get("data", [])
        print("BARS:", len(bars) if isinstance(bars, list) else "not-list")
        if isinstance(bars, list) and bars:
            print("LATEST:", bars[-1])
            print("OLDEST:", bars[0])
        else:
            print("NO HISTORICAL BARS")
    except Exception as e:
        print("ERROR:", str(e))


def test_yahoo(symbol):
    print("\n===== YAHOO:", symbol, "=====")
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + quote(symbol, safe="")
    )
    params = {"range": "1y", "interval": "1d", "events": "history"}
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, params=params,
                         headers=headers, timeout=40)
        print("HTTP:", r.status_code)
        body = r.json()
        result = body.get("chart", {}).get("result")
        if not result:
            print("YAHOO ERROR:", body.get("chart", {}).get("error"))
            return

        item = result[0]
        timestamps = item.get("timestamp", [])
        quote_data = item.get("indicators", {}).get("quote", [{}])[0]
        print("CURRENCY:", item.get("meta", {}).get("currency"))
        print("BARS:", len(timestamps))

        for i in range(max(0, len(timestamps) - 3), len(timestamps)):
            day = datetime.fromtimestamp(
                timestamps[i], timezone.utc
            ).date().isoformat()
            print("BAR:", day, {
                k: v[i] if i < len(v) else None
                for k, v in quote_data.items()
            })
    except Exception as e:
        print("ERROR:", str(e))


def main():
    print("EGX DATA SOURCE TEST v3")
    if KEY:
        test_datacedar("egx:EGX30")
        time.sleep(1.2)
        test_datacedar("egx:EGS01041C010")
    else:
        print("DATACEDAR_KEY missing")

    for symbol in ["^CASE30", "COMI.CA", "EGS69491M015.CA"]:
        test_yahoo(symbol)
        time.sleep(1)


if __name__ == "__main__":
    main()
