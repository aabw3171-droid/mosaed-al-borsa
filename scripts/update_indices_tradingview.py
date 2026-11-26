
"""تحميل بيانات EGX30 التاريخية من TradingView إلى Supabase."""
import os
import json
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import websocket

SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BARS = max(2, min(int(os.environ.get("BARS", "365")), 5000))
CAIRO = ZoneInfo("Africa/Cairo")


def frame(method, params):
    body = json.dumps({"m": method, "p": params}, separators=(",", ":"))
    return f"~m~{len(body)}~m~{body}"


def unpack(raw):
    import re
    out = []
    for m in re.finditer(r"~m~(\d+)~m~", raw):
        start = m.end()
        try:
            out.append(json.loads(raw[start:start + int(m.group(1))]))
        except Exception:
            pass
    return out


def fetch():
    ws = websocket.create_connection(
        "wss://data.tradingview.com/socket.io/websocket",
        timeout=15,
        origin="https://www.tradingview.com",
        header=["User-Agent: Mozilla/5.0"]
    )
    chart = "cs_egx30"
    candles = {}
    try:
        ws.send(frame("set_auth_token", ["unauthorized_user_token"]))
        ws.send(frame("chart_create_session", [chart, ""]))
        ws.send(frame("resolve_symbol", [
            chart, "symbol_1",
            json.dumps({
                "symbol": "EGX:EGX30",
                "adjustment": "splits",
                "session": "regular"
            })
        ]))
        ws.send(frame("create_series", [
            chart, "s1", "s1", "symbol_1", "1D", BARS
        ]))

        deadline = time.time() + 100
        while time.time() < deadline:
            try:
                raw = ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
            for msg in unpack(raw):
                method = msg.get("m")
                params = msg.get("p", [])
                if method == "timescale_update" and len(params) > 1:
                    series = params[1].get("s1", {})
                    for item in series.get("s", []):
                        v = item.get("v", [])
                        if len(v) >= 6 and v[4] is not None:
                            day = datetime.fromtimestamp(
                                int(v[0]), timezone.utc
                            ).astimezone(CAIRO).date().isoformat()
                            candles[day] = {
                                "symbol": "EGX30",
                                "trade_date": day,
                                "open": v[1],
                                "high": v[2],
                                "low": v[3],
                                "close": v[4],
                                "volume": int(v[5]) if v[5] is not None else None
                            }
                if method == "series_completed" and candles:
                    return sorted(candles.values(), key=lambda x: x["trade_date"])
                if method == "critical_error":
                    raise RuntimeError(str(params))

        if not candles:
            raise RuntimeError("لم تصل بيانات EGX30 من TradingView")
        return sorted(candles.values(), key=lambda x: x["trade_date"])
    finally:
        ws.close()


def save(rows):
    import urllib.request
    url = SUPABASE + "/rest/v1/prices?on_conflict=symbol,trade_date"
    headers = {
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }
    for i in range(0, len(rows), 200):
        req = urllib.request.Request(
            url,
            data=json.dumps(rows[i:i + 200]).encode(),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError("فشل الحفظ في Supabase")


def main():
    print("جاري تحميل تاريخ EGX30:", BARS, "جلسة")
    rows = fetch()
    print("عدد الجلسات:", len(rows))
    print("من:", rows[0]["trade_date"], "إلى:", rows[-1]["trade_date"])
    save(rows)
    print("تم حفظ بيانات EGX30 التاريخية.")


if __name__ == "__main__":
    main()
