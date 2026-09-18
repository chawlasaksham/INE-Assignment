import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function SearchModal({ isOpen, onClose, onProductTracked, existingProductIds = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingId, setTrackingId] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.searchCatalog(query);
        setResults(data.items || []);
      } catch (err) {
        setError(err.message || 'Failed to search catalog');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleTrack = async (product) => {
    setTrackingId(product.id);
    try {
      await api.trackProduct(product);
      onProductTracked();
      onClose();
    } catch (err) {
      alert(`Error tracking product: ${err.message}`);
    } finally {
      setTrackingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Search INE Mock Store</h2>
            <p className="text-xs text-slate-500">Search by product name, brand, category, or SKU</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Copperpot, Kettle, Headphones, SKU..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Searching store products...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No products found matching "{query}".
            </div>
          )}

          {!loading && results.map((product) => {
            const isTracked = existingProductIds.includes(product.id);
            const isBusy = trackingId === product.id;

            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border border-slate-100 hover:border-blue-100 rounded-lg bg-white hover:bg-blue-50/30 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {product.category || 'General'}
                    </span>
                    <span className="text-xs text-slate-400">SKU: {product.sku}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 truncate mt-1">
                    {product.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Brand: <span className="font-medium text-slate-700">{product.brand}</span>
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {isTracked ? (
                    <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTrack(product)}
                      disabled={isBusy}
                      className="inline-flex items-center text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 mr-1" />
                      )}
                      Track Product
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

