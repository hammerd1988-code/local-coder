# Prometheus Metrics Documentation

This application exposes comprehensive Prometheus metrics for monitoring application performance, resource usage, and operational insights.

## Metrics Endpoint

Metrics are available at:
- Development: `http://localhost:3001/metrics`
- Production: `http://localhost:4000/metrics`
- Kubernetes: `http://local-coder/metrics`

## Available Metrics

### HTTP Metrics

#### `local_coder_http_requests_total`
**Type:** Counter  
**Labels:** `method`, `route`, `status_code`  
**Description:** Total number of HTTP requests processed

#### `local_coder_http_request_duration_seconds`
**Type:** Histogram  
**Labels:** `method`, `route`, `status_code`  
**Buckets:** 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5 seconds  
**Description:** Duration of HTTP requests in seconds

#### `local_coder_http_request_size_bytes`
**Type:** Histogram  
**Labels:** `method`, `route`  
**Buckets:** 100, 1000, 10000, 100000, 1000000 bytes  
**Description:** Size of HTTP request bodies in bytes

#### `local_coder_http_response_size_bytes`
**Type:** Histogram  
**Labels:** `method`, `route`  
**Buckets:** 100, 1000, 10000, 100000, 1000000 bytes  
**Description:** Size of HTTP response bodies in bytes

### File Operation Metrics

#### `local_coder_file_operations_total`
**Type:** Counter  
**Labels:** `operation` (list, read, create, update, delete), `status` (success, error, not_found, validation_error)  
**Description:** Total number of file operations performed

#### `local_coder_file_operation_duration_seconds`
**Type:** Histogram  
**Labels:** `operation`  
**Buckets:** 0.001, 0.01, 0.05, 0.1, 0.5, 1 seconds  
**Description:** Duration of file operations in seconds

#### `local_coder_files_in_database`
**Type:** Gauge  
**Description:** Current number of files stored in the database

### Terminal Session Metrics

#### `local_coder_terminal_sessions_active`
**Type:** Gauge  
**Description:** Number of currently active terminal sessions

#### `local_coder_terminal_sessions_total`
**Type:** Counter  
**Labels:** `status` (created, closed, exited, error)  
**Description:** Total number of terminal sessions by status

#### `local_coder_terminal_data_transferred_bytes`
**Type:** Counter  
**Labels:** `direction` (inbound, outbound)  
**Description:** Total bytes transferred through terminal sessions

### Git Operation Metrics

#### `local_coder_git_operations_total`
**Type:** Counter  
**Labels:** `operation` (status, branches, create_branch, checkout, commit, clone), `status` (success, error, validation_error)  
**Description:** Total number of git operations performed

#### `local_coder_git_operation_duration_seconds`
**Type:** Histogram  
**Labels:** `operation`  
**Buckets:** 0.01, 0.1, 0.5, 1, 5, 10, 30 seconds  
**Description:** Duration of git operations in seconds

#### `local_coder_git_branches_count`
**Type:** Gauge  
**Description:** Number of git branches in the repository

#### `local_coder_git_unstaged_changes`
**Type:** Gauge  
**Description:** Number of unstaged changes in git

### WebSocket Metrics

#### `local_coder_websocket_connections_active`
**Type:** Gauge  
**Labels:** `type` (terminal)  
**Description:** Number of active WebSocket connections

#### `local_coder_websocket_messages_total`
**Type:** Counter  
**Labels:** `type`, `direction` (sent, received)  
**Description:** Total number of WebSocket messages

### Database Metrics

#### `local_coder_database_queries_total`
**Type:** Counter  
**Labels:** `operation`, `table`, `status`  
**Description:** Total number of database queries

#### `local_coder_database_query_duration_seconds`
**Type:** Histogram  
**Labels:** `operation`, `table`  
**Buckets:** 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1 seconds  
**Description:** Duration of database queries in seconds

### Application Metrics

#### `local_coder_application_info`
**Type:** Gauge  
**Labels:** `version`, `node_version`, `environment`  
**Description:** Application version and environment information

#### `local_coder_application_errors_total`
**Type:** Counter  
**Labels:** `type`, `route`  
**Description:** Total number of application errors

### Default Node.js Metrics

The following standard Node.js metrics are also collected:

- `process_cpu_user_seconds_total` - User CPU time
- `process_cpu_system_seconds_total` - System CPU time
- `process_resident_memory_bytes` - Resident memory size
- `process_heap_bytes` - Process heap size
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_gc_duration_seconds` - Garbage collection duration
- `nodejs_version_info` - Node.js version

## Prometheus Configuration

### ServiceMonitor

The application includes a Kubernetes ServiceMonitor configuration for automatic discovery by Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: local-coder
spec:
  selector:
    matchLabels:
      app: local-coder
  endpoints:
  - port: http
    interval: 30s
    path: /metrics
```

### Alerting Rules

Pre-configured PrometheusRule alerts include:

- **HighErrorRate**: Triggers when error rate exceeds 5% for 5 minutes
- **HighResponseTime**: Triggers when p95 response time exceeds 1 second for 5 minutes
- **HighMemoryUsage**: Triggers when memory usage exceeds 400MB for 5 minutes
- **TerminalSessionsHigh**: Triggers when more than 10 terminal sessions are active for 10 minutes
- **GitOperationFailures**: Triggers when git operations fail at >0.1 per second for 5 minutes

## Grafana Dashboard

A pre-built Grafana dashboard is available at `k8s/grafana-dashboard.json` with the following panels:

1. **HTTP Request Rate** - Requests per second by status code
2. **HTTP Request Duration** - p95 latency by route
3. **Active Terminal Sessions** - Current terminal sessions
4. **Files in Database** - Total files stored
5. **Git Branches** - Number of branches
6. **Unstaged Changes** - Files with uncommitted changes
7. **File Operations Rate** - File operations per second
8. **Git Operations Rate** - Git operations per second
9. **Memory Usage** - Resident and heap memory
10. **CPU Usage** - User and system CPU time
11. **Terminal Data Transfer** - Bytes transferred through terminal
12. **WebSocket Connections** - Active WebSocket connections
13. **Error Rate by Route** - 5xx errors by endpoint

## Example PromQL Queries

### Request Rate by Endpoint
```promql
sum(rate(local_coder_http_requests_total[5m])) by (route)
```

### Error Rate Percentage
```promql
sum(rate(local_coder_http_requests_total{status_code=~"5.."}[5m])) 
/ 
sum(rate(local_coder_http_requests_total[5m])) * 100
```

### p95 Response Time
```promql
histogram_quantile(0.95, 
  sum(rate(local_coder_http_request_duration_seconds_bucket[5m])) by (le, route)
)
```

### File Operation Success Rate
```promql
sum(rate(local_coder_file_operations_total{status="success"}[5m])) 
/ 
sum(rate(local_coder_file_operations_total[5m])) * 100
```

### Terminal Session Churn
```promql
sum(rate(local_coder_terminal_sessions_total{status="created"}[5m]))
```

### Git Operation Duration by Type
```promql
histogram_quantile(0.95, 
  sum(rate(local_coder_git_operation_duration_seconds_bucket[5m])) by (le, operation)
)
```

## Deployment

### Local Development

The metrics endpoint is automatically available when running the application:

```bash
npm start
# Metrics: http://localhost:3001/metrics
```

### Kubernetes

Deploy the ServiceMonitor and PrometheusRule:

```bash
kubectl apply -f k8s/service-monitor.yml
```

Import the Grafana dashboard:

```bash
kubectl create configmap grafana-dashboard-local-coder \
  --from-file=k8s/grafana-dashboard.json \
  -n monitoring
```

### Prometheus Scrape Configuration

For manual Prometheus configuration (without Operator):

```yaml
scrape_configs:
  - job_name: 'local-coder'
    scrape_interval: 30s
    static_configs:
      - targets: ['local-coder:80']
    metrics_path: /metrics
```

## Performance Considerations

- Metrics collection adds minimal overhead (~1-2ms per request)
- Histograms use pre-defined buckets to limit cardinality
- Default metrics are collected every 10 seconds
- Metrics are stored in-memory and exposed on demand
- No external dependencies required

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check ServiceMonitor is in the correct namespace
2. Verify Prometheus has RBAC permissions to scrape endpoints
3. Check the `/metrics` endpoint is accessible: `curl http://local-coder/metrics`
4. Review Prometheus targets page for scrape errors

### High memory usage

If metrics cause memory issues, you can disable specific collectors:

```typescript
// In server/metrics.ts
collectDefaultMetrics({
  register,
  prefix: 'local_coder_',
  // Disable GC metrics if needed
  gcDurationBuckets: []
});
```

### Missing custom metrics

Ensure routes are properly instrumented with the metrics imports:

```typescript
import { fileOperationsTotal, timeOperation } from '../metrics.js';
```
