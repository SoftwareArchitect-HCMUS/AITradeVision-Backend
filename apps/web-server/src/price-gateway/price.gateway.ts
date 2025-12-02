import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PriceUpdate } from '@shared/types/common.types';

/**
 * WebSocket gateway for real-time price updates
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PriceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PriceGateway.name);
  private clientSubscriptions: Map<string, Set<string>> = new Map(); // clientId -> Set of symbols

  constructor(private redisService: RedisService) {}

  /**
   * Handle client connection
   * @param client - Socket client
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
  }

  /**
   * Handle client disconnection
   * @param client - Socket client
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.forEach(symbol => {
        this.redisService.unsubscribeFromPrice(symbol);
      });
    }
    this.clientSubscriptions.delete(client.id);
  }

  /**
   * Subscribe to price updates for a symbol
   * @param client - Socket client
   * @param payload - Subscription payload with symbol
   */
  @SubscribeMessage('subscribe_price')
  handleSubscribePrice(client: Socket, @MessageBody() payload: { symbol: string }): void {
    const symbol = payload.symbol?.toUpperCase();
    if (!symbol) {
      client.emit('error', { message: 'Symbol is required' });
      return;
    }

    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions && !subscriptions.has(symbol)) {
      subscriptions.add(symbol);

      // Subscribe to Redis channel
      this.redisService.subscribeToPrice(symbol, (update: PriceUpdate) => {
        client.emit('price_update', update);
      });

      this.logger.log(`Client ${client.id} subscribed to ${symbol}`);
      client.emit('subscribed', { symbol });
    }
  }

  /**
   * Unsubscribe from price updates for a symbol
   * @param client - Socket client
   * @param payload - Unsubscription payload with symbol
   */
  @SubscribeMessage('unsubscribe_price')
  handleUnsubscribePrice(client: Socket, @MessageBody() payload: { symbol: string }): void {
    const symbol = payload.symbol?.toUpperCase();
    if (!symbol) {
      return;
    }

    const subscriptions = this.clientSubscriptions.get(client.id);
    if (subscriptions && subscriptions.has(symbol)) {
      subscriptions.delete(symbol);
      this.redisService.unsubscribeFromPrice(symbol);
      this.logger.log(`Client ${client.id} unsubscribed from ${symbol}`);
      client.emit('unsubscribed', { symbol });
    }
  }
}

