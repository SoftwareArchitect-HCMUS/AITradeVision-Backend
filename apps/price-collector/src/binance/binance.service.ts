import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { PriceUpdate, TickData } from '@shared/types/common.types';

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
  private isShuttingDown = false;

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
      const streams = this.symbols.map(s => `${s}@aggTrade`).join('/');
      const url = `${process.env.BINANCE_WS_URL || 'wss://fstream.binance.com/ws'}/${streams}`;

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
      const streams = this.symbols.map(s => `${s}@ticker`).join('/');
      const url = `${process.env.BINANCE_SPOT_WS_URL || 'wss://stream.binance.com:9443/ws'}/${streams}`;

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
      
      if (data.e === 'aggTrade') {
        const symbol = data.s.toUpperCase();
        const price = parseFloat(data.p);
        const volume = parseFloat(data.q);
        const timestamp = data.T;
        const side = data.m ? 'sell' : 'buy'; // m=true means seller is maker

        // Create tick data
        const tick: TickData = {
          symbol,
          price,
          volume,
          timestamp,
          side,
        };

        // Store in database
        await this.databaseService.insertTick(tick);

        // Publish price update
        const priceUpdate: PriceUpdate = {
          symbol,
          price,
          timestamp,
          volume,
        };

        await this.redisService.publishPriceUpdate(priceUpdate);
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
      const data = JSON.parse(message);
      
      if (data.e === '24hrTicker') {
        const symbol = data.s.toUpperCase();
        const price = parseFloat(data.c); // Last price
        const volume24h = parseFloat(data.v);
        const change24h = parseFloat(data.P);
        const timestamp = Date.now();

        // Publish price update
        const priceUpdate: PriceUpdate = {
          symbol,
          price,
          timestamp,
          volume24h,
          change24h,
        };

        await this.redisService.publishPriceUpdate(priceUpdate);
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

