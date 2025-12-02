import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PriceUpdate } from '@shared/types/common.types';

/**
 * WebSocket message types
 */
interface WebSocketMessage {
  type: 'subscribe_price' | 'unsubscribe_price';
  symbol?: string;
}

interface WebSocketResponse {
  type: 'subscribed' | 'unsubscribed' | 'price_update' | 'error';
  symbol?: string;
  message?: string;
  data?: PriceUpdate;
}

/**
 * WebSocket gateway for real-time price updates using native WebSocket
 */
@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*',
  },
})
export class PriceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PriceGateway.name);
  private clientSubscriptions: Map<WebSocket, Set<string>> = new Map(); // client -> Set of symbols
  private clientIdMap: Map<WebSocket, string> = new Map(); // client -> unique ID
  private idCounter = 0;

  constructor(private redisService: RedisService) {}

  /**
   * Initialize WebSocket server
   */
  afterInit(server: Server): void {
    this.logger.log('WebSocket server initialized on /ws');
  }

  /**
   * Handle client connection
   * @param client - WebSocket client
   */
  handleConnection(client: WebSocket): void {
    const clientId = `client_${++this.idCounter}`;
    this.clientIdMap.set(client, clientId);
    this.clientSubscriptions.set(client, new Set());
    this.logger.log(`Client connected: ${clientId}`);

    // Handle incoming messages
    client.on('message', (data: Buffer) => {
      this.handleMessage(client, data.toString());
    });

    // Handle errors
    client.on('error', (error) => {
      this.logger.error(`WebSocket error for ${clientId}:`, error);
    });
  }

  /**
   * Handle client disconnection
   * @param client - WebSocket client
   */
  handleDisconnect(client: WebSocket): void {
    const clientId = this.clientIdMap.get(client) || 'unknown';
    this.logger.log(`Client disconnected: ${clientId}`);
    
    const subscriptions = this.clientSubscriptions.get(client);
    if (subscriptions) {
      subscriptions.forEach(symbol => {
        this.redisService.unsubscribeFromPrice(symbol);
      });
    }
    
    this.clientSubscriptions.delete(client);
    this.clientIdMap.delete(client);
  }

  /**
   * Handle incoming WebSocket messages
   * @param client - WebSocket client
   * @param message - Raw message string
   */
  private handleMessage(client: WebSocket, message: string): void {
    this.logger.log(`RAW MESSAGE: ${message}`);
    const clientId = this.clientIdMap.get(client) || 'unknown';
    this.logger.debug(`📨 Received message from ${clientId}: ${message}`);
    
    try {
      const data: WebSocketMessage = JSON.parse(message);
      this.logger.log(`📥 Message type: ${data.type}, Symbol: ${data.symbol || 'N/A'}, Client: ${clientId}`);

      switch (data.type) {
        case 'subscribe_price':
          this.logger.log(`🔔 subscribe_price request received from ${clientId} for symbol: ${data.symbol}`);
          this.handleSubscribePrice(client, data.symbol);
          break;
        case 'unsubscribe_price':
          this.logger.log(`🔕 unsubscribe_price request received from ${clientId} for symbol: ${data.symbol}`);
          this.handleUnsubscribePrice(client, data.symbol);
          break;
        default:
          this.logger.warn(`⚠️ Unknown message type from ${clientId}: ${data.type}`);
          this.sendMessage(client, {
            type: 'error',
            message: `Unknown message type: ${data.type}`,
          });
      }
    } catch (error) {
      this.logger.error(`❌ Error parsing WebSocket message from ${clientId}:`, error);
      this.logger.error(`   Raw message: ${message}`);
      this.sendMessage(client, {
        type: 'error',
        message: 'Invalid message format',
      });
    }
  }

  /**
   * Subscribe to price updates for a symbol
   * @param client - WebSocket client
   * @param symbol - Trading symbol
   */
  private handleSubscribePrice(client: WebSocket, symbol?: string): void {
    const symbolLower = symbol?.toLowerCase();
    const clientId = this.clientIdMap.get(client) || 'unknown';

    this.logger.log(`🔍 Processing subscribe_price for client: ${clientId}, symbol: ${symbol || 'undefined'}`);

    if (!symbolLower) {
      this.logger.warn(`⚠️ subscribe_price failed: Symbol is required (client: ${clientId})`);
      this.sendMessage(client, {
        type: 'error',
        message: 'Symbol is required',
      });
      return;
    }

    const subscriptions = this.clientSubscriptions.get(client);
    if (!subscriptions) {
      this.logger.error(`❌ No subscription set found for client: ${clientId}`);
      return;
    }

    if (subscriptions.has(symbolLower)) {
      this.logger.log(`ℹ️ Client ${clientId} already subscribed to ${symbolLower}`);
      this.sendMessage(client, {
        type: 'subscribed',
        symbol: symbolLower,
      });
      return;
    }

    // Add subscription
    subscriptions.add(symbolLower);
    this.logger.log(`✅ Added ${symbolLower} to subscription set for client ${clientId}`);

    // Subscribe to Redis channel
    this.logger.log(`🔗 Subscribing to Redis channel for ${symbolLower} (client: ${clientId})`);
    this.redisService.subscribeToPrice(symbolLower, (update: PriceUpdate) => {
      this.logger.debug(`💰 Received price update from Redis for ${symbolLower}: ${update.price} (client: ${clientId})`);
      this.sendMessage(client, {
        type: 'price_update',
        symbol: symbolLower,
        data: update,
      });
    });

    this.logger.log(`✅ Client ${clientId} successfully subscribed to ${symbolLower}`);
    this.sendMessage(client, {
      type: 'subscribed',
      symbol: symbolLower,
    });
  }

  /**
   * Unsubscribe from price updates for a symbol
   * @param client - WebSocket client
   * @param symbol - Trading symbol
   */
  private handleUnsubscribePrice(client: WebSocket, symbol?: string): void {
    const symbolLower = symbol?.toLowerCase();
    const clientId = this.clientIdMap.get(client) || 'unknown';

    this.logger.log(`🔍 Processing unsubscribe_price for client: ${clientId}, symbol: ${symbol || 'undefined'}`);

    if (!symbolLower) {
      this.logger.warn(`⚠️ unsubscribe_price failed: Symbol is required (client: ${clientId})`);
      return;
    }

    const subscriptions = this.clientSubscriptions.get(client);
    if (subscriptions && subscriptions.has(symbolLower)) {
      subscriptions.delete(symbolLower);
      this.redisService.unsubscribeFromPrice(symbolLower);
      this.logger.log(`✅ Client ${clientId} unsubscribed from ${symbolLower}`);
      this.sendMessage(client, {
        type: 'unsubscribed',
        symbol: symbolLower,
      });
    } else {
      this.logger.log(`ℹ️ Client ${clientId} was not subscribed to ${symbolLower}`);
    }
  }

  /**
   * Send message to WebSocket client
   * @param client - WebSocket client
   * @param response - Response message
   */
  private sendMessage(client: WebSocket, response: WebSocketResponse): void {
    const clientId = this.clientIdMap.get(client) || 'unknown';
    
    if (client.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(response);
      if (response.type === 'price_update') {
        // Only log price updates in debug mode to avoid spam
        this.logger.debug(`📤 Sending ${response.type} to ${clientId} for ${response.symbol}`);
      } else {
        this.logger.log(`📤 Sending ${response.type} to ${clientId}${response.symbol ? ` for ${response.symbol}` : ''}`);
      }
      client.send(messageStr);
    } else {
      this.logger.warn(`⚠️ Cannot send message to ${clientId}: WebSocket not open (state: ${client.readyState})`);
    }
  }
}

