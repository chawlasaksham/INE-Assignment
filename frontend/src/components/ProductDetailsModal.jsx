import React, { useState, useEffect } from 'react';
import { X, RefreshCw, TrendingDown, Clock, AlertTriangle, CheckCircle2, History, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../services/api';

export default function ProductDetailsModal({ product, isOpen, onClose, onScrapeTriggered }) {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'logs'
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      const [historyData, logsData] = await Promise.all([
        api.getProductHistory(product.id),
        api.getScrapeLogs(product.product_id)
      ]);
      setHistory(historyData || []);
      setLogs(logsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && product) {
      loadData();
    }
  }, [isOpen, product]);

  const handleManualScrape = async () => {
    if (!product || scraping) return;
    setScraping(true);
    try {
      await api.triggerProductScrape(product.id);
      await loadData();
      if (onScrapeTriggered) onScrapeTriggered();
    } catch (err) {
      alert(`Scrape failed: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  if (!isOpen || !product) return null;

  // Chart data formatted
  const chartData = history.map((item) => {
    const d = new Date(item.scraped_at);
    return {
      time: `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      price: Number(item.price),
      stock: Number(item.stock)
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="min-w-0 pr-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded">
                {product.category || 'General'}
              </span>
              <span className="text-xs text-slate-400">SKU: {product.sku}</span>
              <span className="text-xs text-slate-400">ID: {product.product_id}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1 truncate">
              {product.name}
            </h2>
            <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
              <span>Brand: <strong className="text-slate-700">{product.brand}</strong></span>
              <span>•</span>
              <a
                href={product.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
              >
                View on Mock Store <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleManualScrape}
              disabled={scraping}
              className="inline-flex items-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3.5 py-2 rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping Live...' : 'Scrape Now'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current State Summary Bar */}
        <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-500">Current Price:</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {product.current_price ? `₹${Number(product.current_price).toLocaleString('en-IN')}` : 'Not Scraped Yet'}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Current Stock:</span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {product.current_stock !== null ? `${product.current_stock} units` : 'Unknown'}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Last Scraped:</span>
            <div className="text-slate-700 mt-0.5 font-medium">
              {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleString() : 'Pending initial scrape'}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-semibold transition-colors mr-6 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Price & Stock History ({history.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Scrape Attempt Logs ({logs.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Loading data...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg mb-4">
              {error}
            </div>
          )}

          {!loading && activeTab === 'history' && (
            <div className="space-y-6">
              {/* Chart */}
              {chartData.length > 0 ? (
                <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                    Price & Stock Trends Over Time
                  </h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation="left" stroke="#2563eb" />
                        <YAxis yAxisId="right" tick={{ fontSize: 11 }} orientation="right" stroke="#10b981" />
                        <Tooltip
                          formatter={(val, name) => [
                            name === 'Price (₹)' ? `₹${Number(val).toLocaleString('en-IN')}` : `${val} units`,
                            name
                          ]}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="price"
                          name="Price (₹)"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="stock"
                          name="Stock (units)"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  No historical observations recorded yet. Click "Scrape Now" to capture the first observation.
                </div>
              )}

              {/* History Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Historical Observations Table
                </h4>
                {history.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Observation Timestamp</th>
                          <th className="py-2.5 px-4">Price (INR)</th>
                          <th className="py-2.5 px-4">Stock Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-slate-600">
                              {new Date(row.scraped_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">
                              ₹{Number(row.price).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                row.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {row.stock > 0 ? `${row.stock} in stock` : 'Out of stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!loading && activeTab === 'logs' && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Scrape Attempt Logs
              </h4>
              {logs.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Attempt #</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Duration</th>
                        <th className="py-2.5 px-4">Extracted / Error Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => {
                        let statusBadge = (
                          <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                          </span>
                        );
                        if (log.status === 'retried') {
                          statusBadge = (
                            <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3 mr-1" /> Retried
                            </span>
                          );
                        } else if (log.status === 'failed') {
                          statusBadge = (
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
                            <td className="py-2.5 px-4 font-medium text-slate-700">
                              Attempt {log.attempt_number}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {statusBadge}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500">
                              {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                            </td>
                            <td className="py-2.5 px-4">
                              {log.status === 'success' ? (
                                <span className="text-slate-800">
                                  Price: <strong>₹{log.price}</strong> | Stock: <strong>{log.stock}</strong>
                                </span>
                              ) : (
                                <span className="text-rose-600 font-mono text-[11px]">
                                  {log.error_message || 'Unknown failure'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  No scrape logs recorded for this product yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

