
/* تحليل فني للأسهم المصرية - النسخة المصححة */
(function () {
  'use strict';

  function sma(values, period) {
    if (values.length < period) return null;
    const part = values.slice(-period);
    return part.reduce((sum, v) => sum + v, 0) / period;
  }

  function calculateRSI(values, period) {
    period = period || 14;
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      avgGain = (avgGain * (period - 1) +
        Math.max(change, 0)) / period;

      avgLoss = (avgLoss * (period - 1) +
        Math.max(-change, 0)) / period;
    }

    if (avgLoss === 0) return 100;

    return 100 - (100 / (1 + avgGain / avgLoss));
  }

  function scoreAll(rows, names) {
    const grouped = Object.create(null);
    const results = [];

    (rows || []).forEach(function (row) {
      if (!row || !row.symbol || row.close == null) return;

      const price = Number(row.close);
      if (!Number.isFinite(price) || price <= 0) return;

      if (!grouped[row.symbol]) {
        grouped[row.symbol] = [];
      }

      grouped[row.symbol].push(row);
    });

    Object.keys(grouped).forEach(function (symbol) {
      const data = grouped[symbol].sort(function (a, b) {
        return String(a.trade_date).localeCompare(
          String(b.trade_date)
        );
      });

      if (data.length < 60) return;

      const close = data.map(r => Number(r.close));
      const high = data.map(r =>
        Number(r.high || r.close)
      );
      const low = data.map(r =>
        Number(r.low || r.close)
      );
      const volume = data.map(r =>
        Number(r.volume || 0)
      );

      if (close.some(v => !Number.isFinite(v) || v <= 0)) {
        return;
      }

      const n = close.length;
      const last = close[n - 1];
      const previous = close[n - 2];

      const ma20 = sma(close, 20);
      const ma50 = sma(close, 50);
      const rsi = calculateRSI(close, 14);

      const avgVolume = sma(volume.slice(0, -1), 20) || 0;
      const lastVolume = volume[n - 1];

      const previousHigh = Math.max(
        ...high.slice(-21, -1)
      );

      const support = Math.min(
        ...low.slice(-20)
      );

      const resistance = Math.max(
        ...high.slice(-20)
      );

      let score = 0;
      const reasons = [];

      // الاتجاه العام
      if (last > ma20 && ma20 > ma50) {
        score += 2;
        reasons.push('اتجاه صاعد');
      } else if (last < ma20 && ma20 < ma50) {
        score -= 2;
        reasons.push('اتجاه هابط');
      }

      // مؤشر RSI
      if (rsi !== null) {
        if (rsi >= 45 && rsi <= 65) {
          score += 1;
          reasons.push('RSI متوازن: ' + rsi.toFixed(1));
        } else if (rsi > 75) {
          score -= 2;
          reasons.push('تشبع شرائي');
        } else if (rsi < 30) {
          reasons.push('تشبع بيعي');
        }
      }

      // الاختراق
      if (last > previousHigh) {
        score += 1;
        reasons.push('اختراق قمة 20 جلسة');
      }

      // حجم التداول
      if (
        avgVolume > 0 &&
        lastVolume > avgVolume * 1.5
      ) {
        score += 1;
        reasons.push('حجم تداول مرتفع');
      }

      // MACD إذا كانت الدالة متاحة
      if (typeof window.macd === 'function') {
        const macdResult = window.macd(close);

        if (
          macdResult &&
          macdResult.h > 0 &&
          macdResult.h > macdResult.hp
        ) {
          score += 1;
          reasons.push('MACD إيجابي ويتقوى');
        }
      }

      const change = previous
        ? ((last - previous) / previous) * 100
        : 0;

      results.push({
        symbol: symbol,
        name: names && names[symbol]
          ? names[symbol]
          : symbol,

        score: score,
        totalScore: score,
        points: score,
        rating: score,

        lastPrice: last,
        changePct: change,
        rsi: rsi,
        volume: lastVolume,

        date: data[n - 1].trade_date,
        support: support,
        resistance: resistance,

        why: reasons,
        reasons: reasons
      });
    });

    return results.sort(function (a, b) {
      return b.score - a.score;
    });
  }

  window.scoreAll = scoreAll;

})();
