import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { PriceUpdate, TickData, OHLCVData } from '@shared/types/common.types';

/**
 * Binance WebSocket service for real-time price collection
 */
@Injectable()
export class BinanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceService.name);
  private futuresWS: WebSocket | null = null;
  private spotWS: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds
  private symbols: string[] = [];
  private readonly timeframes: string[] = ['1m', '5m', '1h', '1d'];
  private isShuttingDown = false;
  private readonly THROTTLE_MS = 100;
  private lastPublishTime: Map<string, number> = new Map();
  private ticker24hData: Map<string, { change24h: number; volume24h: number }> = new Map();

  constructor(
    private redisService: RedisService,
    private databaseService: DatabaseService,
  ) {}

  /**
   * Initialize Binance WebSocket connections
   */
  async onModuleInit(): Promise<void> {
    this.symbols = await this.databaseService.getActiveSymbols();
    
    if (this.symbols.length === 0) {
      this.logger.warn('No active symbols found, using default symbols');
      this.symbols = ['btcusdt', 'ethusdt', 'solusdt'];
    }

    this.logger.log(`Connecting to Binance for ${this.symbols.length} symbols`);
    await this.connectFutures();
    await this.connectSpot();
  }

  /**
   * Cleanup WebSocket connections
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.futuresWS) {
      this.futuresWS.close();
    }
    if (this.spotWS) {
      this.spotWS.close();
    }
  }

  /**
   * Connect to Binance Futures WebSocket
   */
  private async connectFutures(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      // Build streams for all symbols and timeframes: btcusdt@kline_1m/btcusdt@kline_5m/ethusdt@kline_1m/...
      const streams: string[] = [];
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          streams.push(`${symbol.toLowerCase()}@kline_${timeframe}`);
        }
        streams.push(`${symbol.toLowerCase()}@ticker`);
      }
      const streamsPath = streams.join('/');
      const url = `${process.env.BINANCE_WS_URL || 'wss://fstream.binance.com/stream'}?streams=${streamsPath}`;

      this.futuresWS = new WebSocket(url);

      this.futuresWS.on('open', () => {
        this.logger.log('Binance Futures WebSocket connected');
        this.reconnectAttempts = 0;
      });

      this.futuresWS.on('message', (data: WebSocket.Data) => {
        this.handleFuturesMessage(data.toString());
      });

      this.futuresWS.on('error', (error) => {
        this.logger.error('Binance Futures WebSocket error', error);
      });

      this.futuresWS.on('close', () => {
        this.logger.warn('Binance Futures WebSocket closed');
        if (!this.isShuttingDown) {
          this.scheduleReconnect('futures');
        }
      });
    } catch (error) {
      this.logger.error('Failed to connect to Binance Futures', error);
      this.scheduleReconnect('futures');
    }
  }

  /**
   * Connect to Binance Spot WebSocket
   */
  private async connectSpot(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      // Build streams for all symbols and timeframes: btcusdt@kline_1m/btcusdt@kline_5m/ethusdt@kline_1m/...
      const streams: string[] = [];
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          streams.push(`${symbol.toLowerCase()}@kline_${timeframe}`);
        }
      }
      const streamsPath = streams.join('/');
      const url = `${process.env.BINANCE_SPOT_WS_URL || 'wss://stream.binance.com:9443/stream'}?streams=${streamsPath}`;
      console.log('Binance Spot WebSocket URL:', url);

      this.spotWS = new WebSocket(url);

      this.spotWS.on('open', () => {
        this.logger.log('Binance Spot WebSocket connected');
      });

      this.spotWS.on('message', (data: WebSocket.Data) => {
        this.handleSpotMessage(data.toString());
      });

      this.spotWS.on('error', (error) => {
        this.logger.error('Binance Spot WebSocket error', error);
      });

      this.spotWS.on('close', () => {
        this.logger.warn('Binance Spot WebSocket closed');
        if (!this.isShuttingDown) {
          this.scheduleReconnect('spot');
        }
      });
    } catch (error) {
      this.logger.error('Failed to connect to Binance Spot', error);
      this.scheduleReconnect('spot');
    }
  }

  /**
   * Handle futures WebSocket message
   * @param message - Raw WebSocket message
   */
  private async handleFuturesMessage(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);

      if (data.e === '24hrTicker') {
        const symbol = data.s.toUpperCase();
        this.ticker24hData.set(symbol, {
          change24h: parseFloat(data.P),
          volume24h: parseFloat(data.q),
        });
        return;
      }

      if (data.e === 'kline' && data.k) {
        const kline = data.k;
        const symbol = kline.s.toUpperCase();
        const interval = kline.i;
        const isClosed = kline.x;
        
        const ohlcv: OHLCVData = {
          symbol,
          interval,
          timestamp: kline.t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };

        const now = Date.now();
        const lastPublish = this.lastPublishTime.get(symbol) || 0;
        
        if (now - lastPublish >= this.THROTTLE_MS) {
          this.lastPublishTime.set(symbol, now);
          
          const tickerData = this.ticker24hData.get(symbol);
          
          const priceUpdate: PriceUpdate = {
            symbol,
            price: ohlcv.close,
            timestamp: kline.T || Date.now(),
            volume: ohlcv.volume,
            change24h: tickerData?.change24h,
            volume24h: tickerData?.volume24h,
          };

          this.redisService.publishPriceUpdate(priceUpdate).catch(err => 
              this.logger.error(`Failed to publish price update for ${symbol}`, err)
          );
        }

        if (isClosed) {
          this.databaseService.insertOHLCV(ohlcv).catch(err => 
            this.logger.error(`Failed to insert OHLCV for ${symbol}`, err)
          );

          const tick: TickData = {
            symbol,
            price: ohlcv.close,
            volume: ohlcv.volume,
            timestamp: kline.T || Date.now(),
            side: ohlcv.close >= ohlcv.open ? 'buy' : 'sell',
          };

          this.databaseService.insertTick(tick).catch(err =>
            this.logger.error(`Failed to insert Tick for ${symbol}`, err)
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling futures message', error);
    }
  }

  /**
   * Handle spot WebSocket message
   * @param message - Raw WebSocket message
   */
  private async handleSpotMessage(message: string): Promise<void> {
    try {
      const payload = JSON.parse(message);
      const data = payload.data || payload;

      if (data.e === '24hrTicker') {
        const symbol = data.s.toUpperCase();
        this.ticker24hData.set(symbol, {
          change24h: parseFloat(data.P),
          volume24h: parseFloat(data.q),
        });
        return;
      }

      if (data.e === 'kline' && data.k) {
        const kline = data.k;
        const symbol = kline.s.toUpperCase();
        const interval = kline.i;
        const isClosed = kline.x;
        
        const ohlcv: OHLCVData = {
          symbol,
          interval,
          timestamp: kline.t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };

        const now = Date.now();
        const lastPublish = this.lastPublishTime.get(symbol) || 0;
        
        if (now - lastPublish >= this.THROTTLE_MS) {
          this.lastPublishTime.set(symbol, now);
          
          const tickerData = this.ticker24hData.get(symbol);
          
          const priceUpdate: PriceUpdate = {
            symbol,
            price: ohlcv.close,
            timestamp: kline.T || Date.now(),
            volume: ohlcv.volume,
            change24h: tickerData?.change24h,
            volume24h: tickerData?.volume24h,
          };

          this.redisService.publishPriceUpdate(priceUpdate).catch(err =>
               this.logger.error(`Failed to publish spot price update for ${symbol}`, err)
          );
        }

        if (isClosed) {
          this.databaseService.insertOHLCV(ohlcv).catch(err =>
             this.logger.error(`Failed to insert Spot OHLCV for ${symbol}`, err)
          );

          const tick: TickData = {
            symbol,
            price: ohlcv.close,
            volume: ohlcv.volume,
            timestamp: kline.T || Date.now(),
            side: ohlcv.close >= ohlcv.open ? 'buy' : 'sell',
          };

          this.databaseService.insertTick(tick).catch(err =>
             this.logger.error(`Failed to insert Spot Tick for ${symbol}`, err)
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling spot message', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * @param type - Connection type ('futures' or 'spot')
   */
  private scheduleReconnect(type: 'futures' | 'spot'): void {
    if (this.isShuttingDown || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached for ${type}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.log(`Scheduling ${type} reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (type === 'futures') {
        this.connectFutures();
      } else {
        this.connectSpot();
      }
    }, delay);
  }
}

