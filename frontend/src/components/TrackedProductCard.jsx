import React, { useState } from 'react';
import { RefreshCw, Trash2, LineChart, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function TrackedProductCard({ product, onSelect, onDeleted, onScraped }) {
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleScrape = async (e) => {
    e.stopPropagation();
    if (scraping) return;
    setScraping(true);
    try {
      await api.triggerProductScrape(product.id);
      if (onScraped) onScraped();
    } catch (err) {
      alert(`Scrape error: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    if (!window.confirm(`Stop tracking "${product.name}"?`)) return;
    setDeleting(true);
    try {
      await api.untrackProduct(product.id);
      if (onDeleted) onDeleted(product.id);
    } catch (err) {
      alert(`Delete error: ${err.message}`);
      setDeleting(false);
    }
  };

  const formattedPrice = product.current_price
    ? `₹${Number(product.current_price).toLocaleString('en-IN')}`
    : null;

  const stockBadgeClass = product.current_stock > 0
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : product.current_stock === 0
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div
      onClick={() => onSelect(product)}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded">
            {product.category || 'General'}
          </span>
          <span className="text-xs font-mono text-slate-400">
            {product.sku}
          </span>
        </div>

        {/* Product Title & Brand */}
        <h3 className="text-base font-bold text-slate-900 mt-2.5 line-clamp-1" title={product.name}>
          {product.name}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Brand: <span className="font-semibold text-slate-700">{product.brand}</span>
        </p>

        {/* Current Metrics */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Current Price
            </span>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {formattedPrice || (
                <span className="text-xs font-normal text-slate-400 italic">
                  Not Scraped Yet
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Stock
            </span>
            <span className={`inline-block text-xs font-bold border px-2 py-0.5 rounded mt-0.5 ${stockBadgeClass}`}>
              {product.current_stock !== null && product.current_stock !== undefined
                ? product.current_stock > 0
                  ? `${product.current_stock} in stock`
                  : 'Out of stock'
                : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center truncate pr-2" title={product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleString() : 'Never'}>
          <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
          <span className="truncate">
            {product.last_scraped_at ? new Date(product.last_scraped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </span>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={handleScrape}
            disabled={scraping}
            title="Scrape Live Now"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(product);
            }}
            title="View History & Charts"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <LineChart className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Untrack Product"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

