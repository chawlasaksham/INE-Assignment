import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TrackedProductCard from './components/TrackedProductCard';
import SearchModal from './components/SearchModal';
import ProductDetailsModal from './components/ProductDetailsModal';
import GlobalLogsModal from './components/GlobalLogsModal';
import { api } from './services/api';
import { Plus, RefreshCw, AlertCircle, Loader2, Package } from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await api.getTrackedProducts();
      setProducts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load tracked products');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts(true);

    // Auto-poll tracked products every 15s to catch background scrape updates
    const interval = setInterval(() => {
      fetchProducts(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleProductDeleted = (deletedId) => {
    setProducts((prev) => prev.filter((p) => p.id !== deletedId));
    if (selectedProduct && selectedProduct.id === deletedId) {
      setSelectedProduct(null);
    }
  };

  const handleProductTracked = () => {
    fetchProducts(false);
  };

  const handleScrapeCompleted = () => {
    fetchProducts(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onRefresh={() => fetchProducts(false)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Intro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Tracked Products ({products.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Active products scraped on schedule via external cron (every 2 hours) or manually on demand
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex items-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Product to Track
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchProducts(true)}
              className="text-xs font-bold text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <p className="text-sm font-medium text-slate-600">Loading tracked products...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs mt-8">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              No products tracked yet
            </h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
              Search the INE mock store for products (e.g. Copperpot, Kettle, Headphones) and add them to your tracking list.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex items-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Search & Track Product
            </button>
          </div>
        )}

        {/* Products Grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <TrackedProductCard
                key={product.id}
                product={product}
                onSelect={(p) => setSelectedProduct(p)}
                onDeleted={handleProductDeleted}
                onScraped={handleScrapeCompleted}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onProductTracked={handleProductTracked}
        existingProductIds={products.map((p) => p.product_id)}
      />

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          onScrapeTriggered={handleScrapeCompleted}
        />
      )}

      <GlobalLogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}

