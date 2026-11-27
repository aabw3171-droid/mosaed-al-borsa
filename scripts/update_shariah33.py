"""تحميل آخر 60 جلسة لمؤشر EGX 33 Shariah من TradingView إلى index_prices."""
import os
import json
import time
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import websocket
import urllib.request

SUPABASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BARS = max(2, min(int(os.environ.get("BARS", "60")), 500))
SYMBOL = "EGX:SHARIAH"
INDEX_CODE = "SHARIAH33"
CAIRO = ZoneInfo("Africa/Cairo")


def frame(method, params):
    body = json.dumps({"m": method, "p": params}, separators=(",", ":"))
    return f"~m~{len(body)}~m~{body}"


def unpack(raw):
    out = []
    for match in re.finditer(r"~m~(\\d+)~m~", raw):
        start = match.end()
        size = int(match.group(1))
        try:
            out.append(json.loads(raw[start:start + size]))
        except (ValueError, TypeError):
            continue
    return out


def fetch_history():
    ws = websocket.create_connection(
        "wss://data.tradingview.com/socket.io/websocket",
        timeout=20,
        origin="https://www.tradingview.com",
        header=["User-Agent: Mozilla/5.0"]
    )
    session = "cs_shariah33"
    candles = {}
    try:
        ws.send(frame("set_auth_token", ["unauthorized_user_token"]))
        ws.send(frame("chart_create_session", [session, ""]))
        ws.send(frame("resolve_symbol", [
            session, "symbol_1",
            json.dumps({
                "symbol": SYMBOL,
                "adjustment": "splits",
                "session": "regular"
            })
        ]))
        ws.send(frame("create_series", [
            session, "s1", "s1", "symbol_1", "1D", BARS
        ]))

        deadline = time.time() + 110
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
                        values = item.get("v", [])
                        if len(values) < 6 or values[4] is None:
                            continue

                        day = datetime.fromtimestamp(
                            int(values[0]), timezone.utc
                        ).astimezone(CAIRO).date().isoformat()

                        close = float(values[4])
                        if close <= 0:
                            continue

                        candles[day] = {
                            "index_code": INDEX_CODE,
                            "trade_date": day,
                            "close": close,
                            "source": "TradingView"
                        }

                if method == "critical_error":
                    raise RuntimeError("TradingView: " + str(params))

                if method == "series_completed" and candles:
                    return sorted(
                        candles.values(),
                        key=lambda row: row["trade_date"]
                    )[-BARS:]

        if not candles:
            raise RuntimeError(
                "لم تصل بيانات EGX:SHARIAH من TradingView خلال المهلة المحددة"
            )

        return sorted(
            candles.values(),
            key=lambda row: row["trade_date"]
        )[-BARS:]
    finally:
        ws.close()


def save(rows):
    url = SUPABASE + "/rest/v1/index_prices?on_conflict=index_code,trade_date"
    headers = {
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }

    for start in range(0, len(rows), 100):
        request = urllib.request.Request(
            url,
            data=json.dumps(rows[start:start + 100]).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError(
                    "فشل الحفظ في Supabase، HTTP " + str(response.status)
                )


def main():
    print("المؤشر:", INDEX_CODE, "| TradingView:", SYMBOL)
    print("عدد الجلسات المطلوب:", BARS)

    rows = fetch_history()
    if len(rows) < 2:
        raise RuntimeError(
            "عدد الجلسات المستلمة غير كافٍ: " + str(len(rows))
        )

    print("عدد الجلسات المستلمة:", len(rows))
    print("أقدم جلسة:", rows[0]["trade_date"])
    print("آخر جلسة:", rows[-1]["trade_date"])
    print("آخر إغلاق:", rows[-1]["close"])

    save(rows)
    print("تم حفظ تاريخ مؤشر الشريعة 33 في index_prices بنجاح.")


if __name__ == "__main__":
    main()
