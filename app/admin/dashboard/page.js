"use client";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filters, setFilters] = useState({
    gateId: "",
    status: "",
    timeRange: "today"
  });

  // Real-time data with 3-second refresh
  const { data, error, isLoading, mutate } = useSWR(
    session?.user?.role === "admin" 
      ? `/api/admin/scan-logs?${new URLSearchParams(filters)}`
      : null,
    fetcher,
    { 
      refreshInterval: 3000, // 3 seconds for near real-time
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  );

  // Redirect if not admin
  if (status !== "loading" && (!session || session.user?.role !== "admin")) {
    router.push("/signin");
    return null;
  }

  if (status === "loading") {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const logs = data?.logs || [];

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getStatusBadge = (result) => {
    if (result === 'VALID') {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">✅ VALID</span>;
    }
    return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">❌ INVALID</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎫 Gate Monitor Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring sistem verifikasi tiket</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Monitoring</span>
          </div>
          <button
            onClick={() => mutate()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">📊</span>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Scans</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalScans || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">✅</span>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Valid Tickets</p>
              <p className="text-2xl font-bold text-green-600">{stats.validScans || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">❌</span>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Invalid Attempts</p>
              <p className="text-2xl font-bold text-red-600">{stats.invalidScans || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">⚡</span>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-purple-600">{stats.successRate || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gate Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            🚪 Gate Activity
          </h3>
          {stats.gateActivity && Object.keys(stats.gateActivity).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.gateActivity).map(([gate, count]) => (
                <div key={gate} className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">{gate}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min((count / Math.max(...Object.values(stats.gateActivity))) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Belum ada aktivitas gate</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            👤 Crew Activity
          </h3>
          {stats.crewActivity && Object.keys(stats.crewActivity).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.crewActivity).slice(0, 5).map(([crew, count]) => (
                <div key={crew} className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium text-sm">
                    {crew.length > 20 ? `${crew.substring(0, 20)}...` : crew}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Belum ada aktivitas crew</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gate</label>
            <select
              value={filters.gateId}
              onChange={(e) => updateFilter('gateId', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All Gates</option>
              <option value="GATE_A1">Gate A1</option>
              <option value="GATE_A2">Gate A2</option>
              <option value="GATE_B1">Gate B1</option>
              <option value="GATE_B2">Gate B2</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All Status</option>
              <option value="VALID">Valid Only</option>
              <option value="INVALID">Invalid Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => updateFilter('timeRange', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="hour">Last Hour</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ gateId: "", status: "", timeRange: "today" })}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Recent Scan Logs */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              📋 Recent Scans
            </h3>
            <div className="text-sm text-gray-600">
              {data?.filteredCount || 0} of {data?.totalLogs || 0} logs
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full mx-auto mb-4"></div>
              <p>Loading scan logs...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">
              Error loading scan logs
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No scan logs found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crew</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(log.verificationResult)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{log.customerName || 'N/A'}</p>
                        <p className="text-gray-500 text-xs">{log.customerEmail || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="max-w-32 truncate" title={log.eventName}>
                        {log.eventName || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-mono">
                        {log.gateId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="max-w-24 truncate" title={log.crewEmail}>
                        {log.crewEmail?.split('@')[0] || 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}