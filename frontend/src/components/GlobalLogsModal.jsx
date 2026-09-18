import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function GlobalLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getScrapeLogs(null, 100);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">System Scrape Audit Logs</h2>
            <p className="text-xs text-slate-500">Every scrape attempt is recorded honestly with attempt numbers and durations</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-1.5 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs">
          <span className="font-semibold text-slate-500 mr-2">Filter Status:</span>
          {['all', 'success', 'retried', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Loading logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No logs matching "{statusFilter}".
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Product ID</th>
                    <th className="py-2.5 px-4">Attempt #</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Result / Error Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    let badge = (
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                      </span>
                    );
                    if (log.status === 'retried') {
                      badge = (
                        <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 mr-1" /> Retried
                        </span>
                      );
                    } else if (log.status === 'failed') {
                      badge = (
                        <span className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Failed
                        </span>
                      );
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                          #{log.product_id}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-700">
                          Attempt {log.attempt_number}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {badge}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          {log.status === 'success' ? (
                            <span className="text-slate-800 font-medium">
                              Price: ₹{log.price} | Stock: {log.stock} units
                            </span>
                          ) : (
                            <span className="text-rose-600 font-mono text-[11px]">
                              {log.error_message || 'Failure recorded'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

