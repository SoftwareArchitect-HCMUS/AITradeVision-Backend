# WebSocket Connection Diagnostic Script for Windows
# Run with: powershell -ExecutionPolicy Bypass -File diagnose-connections.ps1

Write-Host "=== WebSocket Connection Diagnostics ===" -ForegroundColor Green

# Function to run docker command and capture output
function Invoke-DockerCommand {
    param($Command)
    try {
        $result = docker exec crypto-web-server $Command 2>&1
        return $result
    } catch {
        Write-Host "Error running command: $Command" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $null
    }
}

# Check if Docker container is running
Write-Host "`n1. Checking Docker container status..." -ForegroundColor Yellow
$containerStatus = docker ps --filter "name=crypto-web-server" --format "table {{.Names}}\t{{.Status}}"
if ($containerStatus -like "*crypto-web-server*") {
    Write-Host "✓ Web server container is running" -ForegroundColor Green
    Write-Host $containerStatus
} else {
    Write-Host "✗ Web server container is not running!" -ForegroundColor Red
    Write-Host "Start with: docker compose up -d"
    exit 1
}

# Check current resource limits
Write-Host "`n2. Checking Docker resource limits..." -ForegroundColor Yellow
$dockerStats = docker stats crypto-web-server --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
Write-Host $dockerStats

# Check file descriptor limits
Write-Host "`n3. Checking file descriptor limits..." -ForegroundColor Yellow
$ulimitResult = Invoke-DockerCommand "sh -c 'ulimit -n'"
if ($ulimitResult) {
    Write-Host "Current ulimit -n (file descriptors): $ulimitResult"
    if ([int]$ulimitResult -lt 5000) {
        Write-Host "⚠️  File descriptor limit is low. Recommended: 10000+" -ForegroundColor Yellow
    } else {
        Write-Host "✓ File descriptor limit is adequate" -ForegroundColor Green
    }
} else {
    Write-Host "Could not check ulimit" -ForegroundColor Red
}

# Check current open file descriptors
Write-Host "`n4. Checking current open file descriptors..." -ForegroundColor Yellow
$procInfo = Invoke-DockerCommand "sh -c 'cat /proc/self/limits | grep \"Max open files\"'"
if ($procInfo) {
    Write-Host "Process limits: $procInfo"
}

$fdCount = Invoke-DockerCommand "sh -c 'ls /proc/self/fd | wc -l'"
if ($fdCount) {
    Write-Host "Current open FDs: $fdCount"
}

# Check network connections
Write-Host "`n5. Checking network connections..." -ForegroundColor Yellow
$netstatResult = Invoke-DockerCommand "sh -c 'netstat -an | grep :3000 | wc -l'"
if ($netstatResult) {
    Write-Host "Current connections on port 3000: $netstatResult"
}

$establishedConnections = Invoke-DockerCommand "sh -c 'netstat -an | grep :3000 | grep ESTABLISHED | wc -l'"
if ($establishedConnections) {
    Write-Host "ESTABLISHED connections: $establishedConnections"
}

# Check system TCP settings
Write-Host "`n6. Checking TCP settings..." -ForegroundColor Yellow
$tcpSettings = @(
    "net.core.somaxconn",
    "net.ipv4.tcp_max_syn_backlog",
    "net.core.netdev_max_backlog"
)

foreach ($setting in $tcpSettings) {
    $value = Invoke-DockerCommand "sh -c 'sysctl $setting 2>/dev/null || echo \"$setting: not found\"'"
    if ($value) {
        Write-Host "$value"
    }
}

# Check Node.js process info
Write-Host "`n7. Checking Node.js process..." -ForegroundColor Yellow
$nodeProcesses = Invoke-DockerCommand "sh -c 'ps aux | grep node'"
if ($nodeProcesses) {
    Write-Host "Node.js processes:"
    Write-Host $nodeProcesses
}

# Memory usage breakdown
Write-Host "`n8. Memory usage details..." -ForegroundColor Yellow
$memInfo = Invoke-DockerCommand "sh -c 'cat /proc/meminfo | head -10'"
if ($memInfo) {
    Write-Host "Memory info:"
    Write-Host $memInfo
}

# Check for any relevant log errors
Write-Host "`n9. Checking recent container logs for errors..." -ForegroundColor Yellow
$recentLogs = docker logs crypto-web-server --tail 20 2>&1 | Select-String -Pattern "error|Error|ERROR|fail|Fail|FAIL|exception|Exception" 
if ($recentLogs) {
    Write-Host "Recent errors found:"
    $recentLogs | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
    Write-Host "No recent errors in logs" -ForegroundColor Green
}

# Summary and recommendations
Write-Host "`n=== RECOMMENDATIONS ===" -ForegroundColor Green

Write-Host "`n1. File Descriptor Limits:"
Write-Host "   - Current Docker setup should now have ulimits configured"
Write-Host "   - If issues persist, check host system limits: ulimit -n"

Write-Host "`n2. Connection Management:"
Write-Host "   - Use gradual connection establishment (50 connections/second)"
Write-Host "   - Implement connection pooling on client side"
Write-Host "   - Add connection rate limiting on server side"

Write-Host "`n3. Resource Optimization:"
Write-Host "   - Monitor CPU and memory under load"
Write-Host "   - Consider horizontal scaling if needed"
Write-Host "   - Implement proper WebSocket heartbeat/ping-pong"

Write-Host "`n4. Network Tuning:"
Write-Host "   - Increase somaxconn: sysctl net.core.somaxconn=65535"
Write-Host "   - Increase syn backlog: sysctl net.ipv4.tcp_max_syn_backlog=8192"

Write-Host "`n=== Test Commands ===" -ForegroundColor Cyan
Write-Host "Run gradual test: node test/websocket-gradual-test.js"
Write-Host "Check live connections: docker exec crypto-web-server netstat -an | grep :3000 | wc -l"
Write-Host "Monitor resource usage: docker stats crypto-web-server"

Write-Host "`n=== Diagnostic Complete ===" -ForegroundColor Green