"""تحميل مؤشر EGX 33 الشرعي من TradingView إلى جدول index_prices (SHARIAH33)."""
import os, json, time, random, string, urllib.request, urllib.error
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import websocket

SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BARS = max(2, min(int(os.environ.get("BARS", "60")), 5000))
CAIRO = ZoneInfo("Africa/Cairo")
TV_SYMBOL = "EGX:SHARIAH"
INDEX_CODE = "SHARIAH33"

def frame(method, params):
    body = json.dumps({"m": method, "p": params}, separators=(",", ":"))
    return f"~m~{len(body)}~m~{body}"

def unpack(raw):
    import re
    out = []
    for m in re.finditer(r"~m~(\\d+)~m~", raw):
        try:
            out.append(json.loads(raw[m.end():m.end() + int(m.group(1))]))
        except Exception:
            pass
    return out

def fetch():
    ws = websocket.create_connection(
        "wss://data.tradingview.com/socket.io/websocket", timeout=15,
        origin="https://www.tradingview.com", header=["User-Agent: Mozilla/5.0"])
    chart = "cs_" + "".join(random.choices(string.ascii_lowercase, k=8))
    rows = {}
    try:
        ws.send(frame("set_auth_token", ["unauthorized_user_token"]))
        ws.send(frame("chart_create_session", [chart, ""]))
        ws.send(frame("resolve_symbol", [chart, "symbol_1", json.dumps(
            {"symbol": TV_SYMBOL, "adjustment": "splits", "session": "regular"})]))
        ws.send(frame("create_series", [chart, "s1", "s1", "symbol_1", "1D", BARS]))
        deadline = time.time() + 100
        while time.time() < deadline:
            try:
                raw = ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
            if raw.startswith("~h~"):
                ws.send(raw)
                continue
            for msg in unpack(raw):
                m, p = msg.get("m"), msg.get("p", [])
                if m == "timescale_update" and len(p) > 1:
                    for item in p[1].get("s1", {}).get("s", []):
                        v = item.get("v", [])
                        if len(v) >= 5 and v[4] is not None:
                            day = datetime.fromtimestamp(int(v[0]), timezone.utc).astimezone(CAIRO).date().isoformat()
                            rows[day] = {"index_code": INDEX_CODE, "trade_date": day,
                                         "close": float(v[4]), "source": "tradingview"}
                if m == "series_completed" and rows:
                    return sorted(rows.values(), key=lambda x: x["trade_date"])[-BARS:]
                if m == "critical_error":
                    raise RuntimeError(str(p))
        raise RuntimeError("لم تصل بيانات " + TV_SYMBOL)
    finally:
        ws.close()

def save(rows):
    url = SUPABASE + "/rest/v1/index_prices?on_conflict=index_code,trade_date"
    headers = {"apikey": KEY, "Authorization": "Bearer " + KEY,
               "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=minimal"}
    req = urllib.request.Request(url, data=json.dumps(rows).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError("HTTP " + str(response.status))
    except urllib.error.HTTPError as e:
        raise RuntimeError("فشل الحفظ: " + e.read().decode())

if __name__ == "__main__":
    data = fetch()
    if not data:
        raise RuntimeError("لم يتم استلام أي جلسات من TradingView")
    print(len(data), "جلسة من", data[0]["trade_date"], "إلى", data[-1]["trade_date"], "آخر إغلاق", data[-1]["close"])
    save(data)
    print("تم حفظ SHARIAH33")
