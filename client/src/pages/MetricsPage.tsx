import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Activity, ArrowLeft, BarChart3, Database, GitBranch, PlaySquare, RefreshCw } from "lucide-react";
import MetricChart from "../components/MetricChart";
import MetricCard from "../components/MetricCard";

interface MetricData {
  timestamp: number;
  value: number;
}

interface ParsedMetrics {
  httpRequests: MetricData[];
  httpDuration: number;
  terminalSessions: number;
  fileOperations: MetricData[];
  gitOperations: MetricData[];
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

function MetricsPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = React.useState<ParsedMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date>(new Date());

  const fetchMetrics = React.useCallback(async () => {
    try {
      const response = await fetch("/api/metrics");
      const text = await response.text();
      const parsed = parsePrometheusMetrics(text);
      setMetrics(parsed);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefresh]);

  const parsePrometheusMetrics = (text: string): ParsedMetrics => {
    const lines = text.split("\n");
    const timestamp = Date.now();
    
    let httpRequestsCount = 0;
    let httpDurationSum = 0;
    let terminalSessions = 0;
    let fileOperationsCount = 0;
    let gitOperationsCount = 0;
    let cpuUsage = 0;
    let memoryUsage = 0;
    let activeConnections = 0;

    for (const line of lines) {
      if (line.startsWith("#") || !line.trim()) continue;

      if (line.includes("local_coder_http_requests_total")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) httpRequestsCount += parseFloat(match[1]);
      }
      
      if (line.includes("local_coder_http_request_duration_seconds_sum")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) httpDurationSum = parseFloat(match[1]);
      }

      if (line.includes("local_coder_terminal_sessions_active")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) terminalSessions = parseFloat(match[1]);
      }

      if (line.includes("local_coder_file_operations_total")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) fileOperationsCount += parseFloat(match[1]);
      }

      if (line.includes("local_coder_git_operations_total")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) gitOperationsCount += parseFloat(match[1]);
      }

      if (line.includes("process_cpu_user_seconds_total")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) cpuUsage = parseFloat(match[1]);
      }

      if (line.includes("nodejs_heap_size_used_bytes")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) memoryUsage = parseFloat(match[1]) / 1024 / 1024;
      }

      if (line.includes("local_coder_websocket_connections_active")) {
        const match = line.match(/\s+([\d.]+)$/);
        if (match) activeConnections += parseFloat(match[1]);
      }
    }

    return {
      httpRequests: [{ timestamp, value: httpRequestsCount }],
      httpDuration: httpDurationSum,
      terminalSessions,
      fileOperations: [{ timestamp, value: fileOperationsCount }],
      gitOperations: [{ timestamp, value: gitOperationsCount }],
      cpuUsage,
      memoryUsage,
      activeConnections,
    };
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Metrics Dashboard</h1>
              <p className="text-muted-foreground">
                Real-time application performance monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              <Activity className="w-4 h-4" />
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="HTTP Requests"
            value={metrics?.httpRequests[0]?.value.toFixed(0) || "0"}
            icon={<BarChart3 className="w-4 h-4" />}
            description="Total requests processed"
          />
          <MetricCard
            title="Terminal Sessions"
            value={metrics?.terminalSessions.toString() || "0"}
            icon={<PlaySquare className="w-4 h-4" />}
            description="Active terminal sessions"
          />
          <MetricCard
            title="File Operations"
            value={metrics?.fileOperations[0]?.value.toFixed(0) || "0"}
            icon={<Database className="w-4 h-4" />}
            description="Total file operations"
          />
          <MetricCard
            title="Git Operations"
            value={metrics?.gitOperations[0]?.value.toFixed(0) || "0"}
            icon={<GitBranch className="w-4 h-4" />}
            description="Total git commands"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>HTTP Request Performance</CardTitle>
              <CardDescription>Request count and average duration</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricChart
                data={metrics?.httpRequests || []}
                dataKey="value"
                name="Requests"
                color="#3b82f6"
              />
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Average Duration: {metrics?.httpDuration.toFixed(3)}s
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>File Operations</CardTitle>
              <CardDescription>Read, write, and delete operations</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricChart
                data={metrics?.fileOperations || []}
                dataKey="value"
                name="Operations"
                color="#10b981"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Git Operations</CardTitle>
              <CardDescription>Commits, pushes, and other git commands</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricChart
                data={metrics?.gitOperations || []}
                dataKey="value"
                name="Operations"
                color="#f59e0b"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>CPU and memory consumption</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">CPU Time</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics?.cpuUsage.toFixed(2)}s
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((metrics?.cpuUsage || 0) * 10, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics?.memoryUsage.toFixed(2)} MB
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((metrics?.memoryUsage || 0) / 5, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Active Connections</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics?.activeConnections}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grafana Dashboard</CardTitle>
            <CardDescription>
              Advanced metrics visualization with Grafana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/50 rounded-lg p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Deploy the application with Prometheus and Grafana to access advanced
                dashboards
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" asChild>
                  <a
                    href="/k8s/grafana-dashboard.json"
                    download="grafana-dashboard.json"
                  >
                    Download Dashboard JSON
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/api/metrics" target="_blank" rel="noopener noreferrer">
                    View Raw Metrics
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MetricsPage;
