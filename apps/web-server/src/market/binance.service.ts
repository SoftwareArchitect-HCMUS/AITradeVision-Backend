import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { OHLCVDto } from '@shared/dto/market.dto';

/**
 * Binance REST API service for fetching klines/candlestick data
 */
@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly baseURL = 'https://api.binance.com/api/v3';
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Map Binance interval to standard format
   * @param interval - Time interval
   * @returns Binance interval format
   */
  private mapInterval(interval: string): string {
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
      '1M': '1M',
    };
    return intervalMap[interval] || interval;
  }

  /**
   * Fetch klines from Binance API
   * @param symbol - Trading symbol (e.g., BTCUSDT)
   * @param interval - Time interval (1m, 5m, 1h, 1d, etc.)
   * @param limit - Number of candles (max 1000)
   * @param startTime - Start timestamp in milliseconds (optional)
   * @param endTime - End timestamp in milliseconds (optional)
   * @returns Array of OHLCV data
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 1000,
    startTime?: number,
    endTime?: number,
  ): Promise<OHLCVDto[]> {
    try {
      const params: Record<string, any> = {
        symbol: symbol.toUpperCase(),
        interval: this.mapInterval(interval),
        limit: Math.min(limit, 1000), // Binance max limit is 1000
      };

      if (startTime) {
        params.startTime = startTime;
      }

      if (endTime) {
        params.endTime = endTime;
      }

      this.logger.debug(`Fetching klines from Binance: ${symbol}, interval: ${interval}, limit: ${limit}`);

      const response = await this.client.get('/klines', { params });

      // Binance response format: [openTime, open, high, low, close, volume, closeTime, ...]
      const klines = response.data as any[][];

      return klines.map((kline) => ({
        timestamp: kline[0] as number, // Open time
        open: parseFloat(kline[1] as string),
        high: parseFloat(kline[2] as string),
        low: parseFloat(kline[3] as string),
        close: parseFloat(kline[4] as string),
        volume: parseFloat(kline[5] as string),
      }));
    } catch (error: any) {
      this.logger.error(`Failed to fetch klines from Binance: ${error.message}`, error.response?.data);
      throw new Error(`Binance API error: ${error.response?.data?.msg || error.message}`);
    }
  }
}

