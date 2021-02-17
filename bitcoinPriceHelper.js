const axios = require('axios');

const RATE_EXPIRATION_MS = 2 * 60 * 1000;
const DAILY_RATE_EXPIRATION_MS = 2 * 24 * 60 * 60 * 1000; // every two days

class BitcoinPriceHelper {
  _rate = null;
  _rateCachedAt = null;

  _dailyRate = null;
  _dailyRateCachedAt = null;

  _getRateFromCache() {
    if (!this._rateCachedAt) {
      return null;
    }

    if (Date.now() - this._rateCachedAt >= RATE_EXPIRATION_MS) {
      this._rateCachedAt = null;
      this._rate = null;
      return null;
    }

    return this._rate;
  }

  async getRate() {
    const candidate = this._getRateFromCache();
    if (candidate) {
      return candidate;
    }

    const response = await axios.get('https://api.coinbase.com/v2/exchange-rates');
    const rate = response.data?.data?.rates?.BTC;
    if (!rate) {
      return null;
    }

    const _rate = Math.floor(1/parseFloat(rate));

    this._rate = _rate;
    this._rateCachedAt = Date.now();

    return _rate;
  }

  _getDailyRateFromCache() {
    if (!this._dailyRateCachedAt) {
      return null;
    }

    if (Date.now() - this._dailyRateCachedAt >= DAILY_RATE_EXPIRATION_MS) {
      this._dailyRateCachedAt = null;
      this._dailyRate = null;
      return null;
    }

    return this._dailyRate;
  }

  async getDailyRate() {
    const candidate = this._getDailyRateFromCache();
    if (candidate) {
      return candidate;
    }

    const start = 1546300800;
    const end = Math.floor(Date.now() / 1000) - (86400 * 7);

    const response = await axios.get(`https://web-api.coinmarketcap.com/v1/cryptocurrency/ohlcv/historical?id=1&convert=USD&time_start=${start}&time_end=${end}`);

    if (!response?.data?.data?.quotes) {
      // FIXME
      return null;
    }

    const days = response.data.data.quotes.map(entry => {
      const date = entry.time_close;
      const usd = parseFloat(entry.quote.USD.close);

      return { date, usd };
    });


    this._dailyRate = days;
    this._dailyRateCachedAt = Date.now();

    return days;
  }
}

module.exports = BitcoinPriceHelper;
