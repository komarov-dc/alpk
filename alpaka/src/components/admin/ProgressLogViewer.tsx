"use client";

import { useState, useEffect, useRef } from "react";

interface LogLine {
  raw: string;
  timestamp?: string;
  status?: "completed" | "failed";
  nodeLabel?: string;
  completed?: number;
  total?: number;
  percentage?: string;
  error?: string;
}

interface ProgressLogViewerProps {
  jobId: string;
  onClose?: () => void;
}

export function ProgressLogViewer({ jobId, onClose }: ProgressLogViewerProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch new log lines
  const fetchLogs = async () => {
    if (isPaused) return;

    try {
      const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || "";
      const res = await fetch(
        `/api/admin/jobs/${jobId}/progress?offset=${offsetRef.current}`,
        {
          headers: { "X-Alpaka-Internal-Secret": secret },
        },
      );

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      if (data.lines && data.lines.length > 0) {
        // Parse and add new lines
        const parsedLines: LogLine[] = data.lines.map((line: string) => {
          // Try to parse structured line
          const match = line.match(
            /^(.+?) \| (✅|❌) (\w+) \| (.+?)(?: \((.+?)\))? \| Duration: (.+?) \| Progress: (\d+)\/(\d+) \((.+?)\)(.*)$/,
          );

          if (match) {
            return {
              raw: line,
              timestamp: match[1] || "",
              status:
                (match[3]?.toLowerCase() as "completed" | "failed") ||
                "completed",
              nodeLabel: match[4] || "",
              completed: parseInt(match[7] || "0"),
              total: parseInt(match[8] || "0"),
              percentage: match[9] || "0%",
              error: match[10]?.trim() || undefined,
            };
          }

          return { raw: line };
        });

        setLogs((prev) => [...prev, ...parsedLines]);
        offsetRef.current = data.total;
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error("[ProgressLogViewer] Error fetching logs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Polling interval
  useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Start polling every 2 seconds
    intervalRef.current = setInterval(fetchLogs, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [jobId, isPaused]);

  const currentProgress = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-lg">Live Progress Logs</h3>
          <p className="text-sm text-gray-600">Job ID: {jobId}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              !isPaused && !error ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isPaused ? "Paused" : error ? "Error" : "Updating every 2s"}
          </span>
        </div>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
        >
          {isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll
        </label>

        {currentProgress && currentProgress.total && (
          <div className="ml-auto text-sm text-gray-700 font-mono">
            Progress: {currentProgress.completed || 0} / {currentProgress.total}{" "}
            ({currentProgress.percentage || "0%"})
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Log lines */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900 text-gray-100"
      >
        {isLoading && logs.length === 0 ? (
          <div className="text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-gray-500">
            No logs yet. Waiting for execution to start...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="py-1">
              {log.timestamp && (
                <span className="text-gray-500">
                  [{new Date(log.timestamp).toLocaleTimeString()}]{" "}
                </span>
              )}
              {log.status && (
                <span
                  className={
                    log.status === "completed"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {log.status === "completed" ? "✅" : "❌"}{" "}
                </span>
              )}
              {log.nodeLabel && (
                <span className="text-blue-300">{log.nodeLabel}</span>
              )}
              {log.completed !== undefined && log.total !== undefined && (
                <span className="text-gray-400 ml-2">
                  ({log.completed}/{log.total} - {log.percentage})
                </span>
              )}
              {log.error && (
                <span className="text-red-400 ml-2">{log.error}</span>
              )}
              {!log.nodeLabel && (
                <span className="text-gray-400">{log.raw}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
