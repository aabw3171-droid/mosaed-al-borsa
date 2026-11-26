
import os
import time
import requests
from urllib.parse import quote

KEY = os.environ.get("DATACEDAR_KEY")
BASE = "https://api.datacedar.com/v3"
HEADERS = {"X-API-Key": KEY, "Accept": "application/json"}

def request(path, params=None):
    r = requests.get(BASE + path, headers=HEADERS, params=params, timeout=30)
    print("\nGET", r.url)
    print("HTTP:", r.status_code)
    try:
        body = r.json()
    except Exception:
        print(r.text[:1000])
        return None
    if r.status_code != 200:
        print("API ERROR:", body.get("error", body))
        return None
    print("META:", body.get("meta"))
    return body

def test_symbol(sid, label):
    sid_path = quote(sid, safe=":")
    print("\n==========", label, sid, "==========")

    coverage = request(f"/stocks/{sid_path}/bars/range")
    if coverage:
        print("COVERAGE:", coverage.get("data"))

    time.sleep(1)
    result = request(
        f"/stocks/{sid_path}/bars",
        {"timeframe": "1d", "order": "desc", "limit": 10, "adjustment": "raw"}
    )
    if result:
        bars = result.get("data", [])
        print("LATEST BAR COUNT:", len(bars))
        print("PAGINATION:", result.get("pagination"))
        if bars:
            print("LATEST BAR:", bars[0])
        else:
            print("EMPTY DATA: no bars returned")

def main():
    if not KEY:
        print("ERROR: DATACEDAR_KEY missing")
        raise SystemExit(1)

    print("DataCedar EGX diagnostic v2")
    exchanges = request("/exchanges", {"country": "EG"})
    if exchanges:
        for item in exchanges.get("data", []):
            if str(item.get("code", "")).lower() == "egx":
                print("EGX REGISTRY:", item)

    time.sleep(1)
    search = request("/search", {"q": "EGX30", "exchange": "egx"})
    index_sid = None
    if search:
        for item in search.get("data", []):
            if item.get("asset_class") == "index" and item.get("sid"):
                index_sid = item["sid"]
                break

    if index_sid:
        test_symbol(index_sid, "EGX 30")
    else:
        print("EGX30 symbol not found")

    time.sleep(1)
    symbols = request(
        "/exchanges/egx/symbols",
        {"asset_class": "equity", "limit": 5}
    )
    if symbols and symbols.get("data"):
        stock = symbols["data"][0]
        print("DISCOVERED EGX EQUITY:", stock)
        if stock.get("sid"):
            test_symbol(stock["sid"], "EGX equity")
    else:
        print("No EGX equity returned")

if __name__ == "__main__":
    main()
