/**
 * Common types used across services
 */

export type Symbol = string; // e.g., 'BTCUSDT', 'ETHUSDT'

export interface PriceUpdate {
  symbol: Symbol;
  price: number;
  timestamp: number;
  volume?: number;
  volume24h?: number;
  change24h?: number;
}

export interface TickData {
  symbol: Symbol;
  price: number;
  volume: number;
  timestamp: number;
  side: 'buy' | 'sell';
}

export interface OHLCVData {
  symbol: Symbol;
  interval: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

