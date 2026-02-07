# 💥 WebServer Crash Testing Guide

## Resource Limitations Added

The web-server now has strict resource limits in docker-compose.yml:

- **CPU**: 0.5 cores (50% of one CPU)
- **Memory**: 256MB RAM limit
- **Reservations**: 0.25 CPU cores, 128MB RAM

## Testing Strategy

### 1. Start Resource-Limited Server
```bash
cd AITradeVision-Backend
docker-compose up web-server
```

### 2. Normal Load Test
```bash
cd test
node websocket-stress-test.js
```
- 100 connections
- Moderate message rate
- Good for baseline testing

### 3. Aggressive Crash Test  
```bash
cd test
node websocket-crash-test.js
```
- 500 connections
- High message burst rate (10 messages per 100ms)
- Memory pressure with 1KB payloads
- Designed to overwhelm limited resources

## What to Monitor

### Docker Stats
```bash
docker stats crypto-web-server
```
Watch for:
- CPU usage approaching 50%
- Memory usage approaching 256MB
- Container restart events

### Server Logs
```bash
docker logs -f crypto-web-server
```
Look for:
- Out of memory errors
- Connection drops
- Process crashes

### Test Output
The crash test will detect:
- Connection refused errors
- Unexpected disconnections
- Server unresponsiveness

## Expected Failure Points

1. **Memory Exhaustion**: 256MB fills up quickly with WebSocket connections
2. **CPU Throttling**: 0.5 cores may not handle 500+ concurrent connections  
3. **File Descriptor Limits**: Default Node.js limits
4. **Event Loop Blocking**: Too many concurrent operations

## Recovery Testing

After crash detection:
1. Server should auto-restart (unless-stopped policy)
2. Test recovery time
3. Verify data integrity
4. Check if connections can re-establish

## Adjusting Limits

To make testing easier/harder, modify in docker-compose.yml:

```yaml
deploy:
  resources:
    limits:
      cpus: '0.25'     # Even more CPU constrained
      memory: 128M     # Even less memory
```

Or remove limits entirely for comparison testing.