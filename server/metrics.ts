import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import express from 'express';

// Create a Registry to register metrics
export const register = new Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({
  register,
  prefix: 'local_coder_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Request metrics
export const httpRequestDuration = new Histogram({
  name: 'local_coder_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'local_coder_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'local_coder_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'local_coder_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// File operation metrics
export const fileOperationsTotal = new Counter({
  name: 'local_coder_file_operations_total',
  help: 'Total number of file operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const fileOperationDuration = new Histogram({
  name: 'local_coder_file_operation_duration_seconds',
  help: 'Duration of file operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const filesInDatabase = new Gauge({
  name: 'local_coder_files_in_database',
  help: 'Current number of files in database',
  registers: [register],
});

// Terminal session metrics
export const terminalSessionsActive = new Gauge({
  name: 'local_coder_terminal_sessions_active',
  help: 'Number of active terminal sessions',
  registers: [register],
});

export const terminalSessionsTotal = new Counter({
  name: 'local_coder_terminal_sessions_total',
  help: 'Total number of terminal sessions created',
  labelNames: ['status'],
  registers: [register],
});

export const terminalCommandsTotal = new Counter({
  name: 'local_coder_terminal_commands_total',
  help: 'Total number of terminal commands executed',
  registers: [register],
});

export const terminalDataTransferred = new Counter({
  name: 'local_coder_terminal_data_transferred_bytes',
  help: 'Total bytes transferred through terminal',
  labelNames: ['direction'],
  registers: [register],
});

// Git operation metrics
export const gitOperationsTotal = new Counter({
  name: 'local_coder_git_operations_total',
  help: 'Total number of git operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const gitOperationDuration = new Histogram({
  name: 'local_coder_git_operation_duration_seconds',
  help: 'Duration of git operations in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.1, 0.5, 1, 5, 10, 30],
  registers: [register],
});

export const gitBranchesCount = new Gauge({
  name: 'local_coder_git_branches_count',
  help: 'Number of git branches',
  registers: [register],
});

export const gitUnstagedChanges = new Gauge({
  name: 'local_coder_git_unstaged_changes',
  help: 'Number of unstaged changes',
  registers: [register],
});

// Database metrics
export const databaseQueryDuration = new Histogram({
  name: 'local_coder_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const databaseQueriesTotal = new Counter({
  name: 'local_coder_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const databaseConnectionsActive = new Gauge({
  name: 'local_coder_database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// WebSocket metrics
export const websocketConnectionsActive = new Gauge({
  name: 'local_coder_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'],
  registers: [register],
});

export const websocketMessagesTotal = new Counter({
  name: 'local_coder_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['type', 'direction'],
  registers: [register],
});

// Application metrics
export const applicationInfo = new Gauge({
  name: 'local_coder_application_info',
  help: 'Application information',
  labelNames: ['version', 'node_version', 'environment'],
  registers: [register],
});

export const applicationErrors = new Counter({
  name: 'local_coder_application_errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'route'],
  registers: [register],
});

// Initialize application info metric
try {
  const packageJson = await import('../package.json', { assert: { type: 'json' } });
  applicationInfo.labels(
    packageJson.default.version,
    process.version,
    process.env.NODE_ENV || 'development'
  ).set(1);
} catch (error) {
  console.error('Failed to load package.json for metrics:', error);
  applicationInfo.labels('unknown', process.version, process.env.NODE_ENV || 'development').set(1);
}

// Middleware to track HTTP metrics
export function metricsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const start = Date.now();
  
  // Track request size
  const requestSize = parseInt(req.get('content-length') || '0', 10);
  if (requestSize > 0) {
    httpRequestSize.labels(req.method, req.route?.path || req.path).observe(requestSize);
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function (this: express.Response, ...args: any[]): any {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.labels(req.method, route, statusCode).observe(duration);
    httpRequestTotal.labels(req.method, route, statusCode).inc();

    // Track response size
    const responseSize = parseInt(res.get('content-length') || '0', 10);
    if (responseSize > 0) {
      httpResponseSize.labels(req.method, route).observe(responseSize);
    }

    return (originalEnd as (...endArgs: any[]) => any).apply(this, args);
  };

  next();
}

// Metrics endpoint handler
export function metricsHandler(_req: express.Request, res: express.Response) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => {
    res.end(metrics);
  }).catch(error => {
    console.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  });
}

// Utility function to time async operations
export async function timeOperation<T>(
  operation: () => Promise<T>,
  histogram: Histogram<string>,
  labels: Record<string, string | number>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = (Date.now() - start) / 1000;
    histogram.observe(labels, duration);
    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    histogram.observe(labels, duration);
    throw error;
  }
}

console.log('Prometheus metrics initialized');
