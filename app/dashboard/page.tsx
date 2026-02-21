"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreInfo {
  plan: string;
  planName: string;
  creditsRemaining: number;
  creditsUsed: number;
  totalCredits: number;
  altTextStyle: string;
  defaultLanguage: string;
}

interface ImageData {
  id: string;
  url: string;
  altText: string | null;
  localGeneratedAltText: string | null;
  localStatus: string;
}

interface ProductData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  images: ImageData[];
}

interface DashboardData {
  store: StoreInfo;
  products: ProductData[];
  pagination: { nextCursor: string | null; hasNextPage: boolean };
  stats: {
    totalGenerated: number;
    totalApplied: number;
    totalImages: number;
    imagesWithAlt: number;
    coveragePercent: number;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [editingImages, setEditingImages] = useState<Record<string, string>>({});

  const fetchData = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const url = cur ? `/api/products?cursor=${cur}` : "/api/products";
      const res = await fetch(url);
      if (res.status === 401) { window.location.href = "/connect"; return; }
      const json = await res.json();
      setData(json);
      setSelectedImages(new Set());
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load products." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleImage = (id: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProduct = (product: ProductData) => {
    const ids = product.images.map((i) => i.id);
    const allSelected = ids.every((id) => selectedImages.has(id));
    setSelectedImages((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAll = () => {
    if (!data) return;
    const allIds = data.products.flatMap((p) => p.images.map((i) => i.id));
    const allSelected = allIds.every((id) => selectedImages.has(id));
    setSelectedImages(allSelected ? new Set() : new Set(allIds));
  };

  const productCheckState = (product: ProductData) => {
    const ids = product.images.map((i) => i.id);
    const count = ids.filter((id) => selectedImages.has(id)).length;
    if (count === 0) return false;
    if (count === ids.length) return true;
    return "indeterminate" as const;
  };

  // ── Bulk generate ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!data || selectedImages.size === 0) return;
    setBusy(true);
    const items: any[] = [];
    for (const p of data.products) {
      for (const img of p.images) {
        if (selectedImages.has(img.id)) {
          items.push({
            productId: p.id,
            productName: p.title,
            imageId: img.id,
            imageUrl: img.url,
            tags: p.tags.join(","),
            description: p.description,
          });
        }
      }
    }
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (json.error) { showMsg("error", json.error); }
      else { showMsg("success", json.message); fetchData(cursor); }
    } catch { showMsg("error", "Generation failed."); }
    finally { setBusy(false); setSelectedImages(new Set()); }
  };

  // ── Bulk apply ─────────────────────────────────────────────────────────────

  const handleApply = async () => {
    if (!data || selectedImages.size === 0) return;
    const items: any[] = [];
    for (const p of data.products) {
      for (const img of p.images) {
        if (selectedImages.has(img.id) && img.localGeneratedAltText) {
          items.push({ productId: p.id, imageId: img.id });
        }
      }
    }
    if (!items.length) { showMsg("error", "None of the selected images have generated alt text."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (json.error) { showMsg("error", json.error); }
      else { showMsg("success", json.message); fetchData(cursor); }
    } catch { showMsg("error", "Apply failed."); }
    finally { setBusy(false); setSelectedImages(new Set()); }
  };

  // ── Inline edit ────────────────────────────────────────────────────────────

  const saveEdit = async (productId: string, imageId: string) => {
    const altText = editingImages[imageId];
    if (altText === undefined) return;
    await fetch("/api/apply", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, imageId, altText }),
    });
    setEditingImages((prev) => { const n = { ...prev }; delete n[imageId]; return n; });
    fetchData(cursor);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-sm animate-pulse">Loading products…</div>
      </div>
    );
  }

  if (!data) return null;

  const { store, products, pagination, stats } = data;
  const creditsUsedPct = store.totalCredits > 0
    ? Math.round((store.creditsUsed / store.totalCredits) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">SpectoAI — Alt Text</h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-medium text-indigo-600">Dashboard</Link>
            <Link href="/settings" className="text-gray-600 hover:text-gray-900">Settings</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Plan" value={store.planName}>
            <div className="text-xs text-gray-500 mt-1">{store.creditsRemaining} credits left</div>
            <ProgressBar value={creditsUsedPct} />
          </StatCard>
          <StatCard label="Coverage" value={`${stats.coveragePercent}%`}>
            <div className="text-xs text-gray-500 mt-1">{stats.imagesWithAlt}/{stats.totalImages} images</div>
            <ProgressBar value={stats.coveragePercent} color={stats.coveragePercent === 100 ? "green" : "indigo"} />
          </StatCard>
          <StatCard label="Generated" value={String(stats.totalGenerated)}>
            <div className="text-xs text-gray-500 mt-1">all-time AI alt texts</div>
          </StatCard>
          <StatCard label="Applied" value={String(stats.totalApplied)}>
            <div className="text-xs text-gray-500 mt-1">active on your store</div>
          </StatCard>
        </div>

        {/* Alert banners */}
        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}
          </div>
        )}

        {/* Sticky action bar */}
        {selectedImages.size > 0 && (
          <div className="sticky top-4 z-50">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">
                  {selectedImages.size} image{selectedImages.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={() => setSelectedImages(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton onClick={handleGenerate} loading={busy} variant="secondary">
                  Generate AI Alt Text ({selectedImages.size})
                </ActionButton>
                <ActionButton onClick={handleApply} loading={busy} variant="primary">
                  Apply to Squarespace ({selectedImages.size})
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* Product list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-indigo-600"
                checked={(() => {
                  const all = products.flatMap((p) => p.images.map((i) => i.id));
                  if (!all.length) return false;
                  return all.every((id) => selectedImages.has(id));
                })()}
                onChange={selectAll}
              />
              <span className="text-sm font-semibold text-gray-700">Products & Images</span>
              <button
                onClick={() => setExpandedProducts(new Set(products.map((p) => p.id)))}
                className="text-xs text-indigo-500 hover:underline"
              >
                Expand all
              </button>
              <button
                onClick={() => setExpandedProducts(new Set())}
                className="text-xs text-gray-400 hover:underline"
              >
                Collapse all
              </button>
            </div>
            <span className="text-xs text-gray-400">Select images to generate or apply in bulk</span>
          </div>

          {products.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No products found. Add products to your Squarespace store to get started.
            </div>
          ) : (
            <>
              {products.map((product, pi) => {
                const missingCount = product.images.filter((i) => !i.altText).length;
                const isExpanded = expandedProducts.has(product.id);

                return (
                  <div
                    key={product.id}
                    className={pi < products.length - 1 ? "border-b border-gray-100" : ""}
                  >
                    {/* Product row */}
                    <div className="px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600"
                          checked={productCheckState(product) === true}
                          ref={(el) => {
                            if (el) el.indeterminate = productCheckState(product) === "indeterminate";
                          }}
                          onChange={() => toggleProduct(product)}
                        />
                        {product.images[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.images[0].url}
                            alt={product.title}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <button
                          className="flex items-center gap-2 text-left"
                          onClick={() => {
                            setExpandedProducts((prev) => {
                              const next = new Set(prev);
                              next.has(product.id) ? next.delete(product.id) : next.add(product.id);
                              return next;
                            });
                          }}
                        >
                          <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                          <span className="text-sm font-medium text-gray-900">{product.title}</span>
                          <span className="text-xs text-gray-400">
                            ({product.images.length} {product.images.length === 1 ? "image" : "images"})
                          </span>
                        </button>
                      </div>
                      {missingCount > 0 ? (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          {missingCount} missing
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          All applied ✓
                        </span>
                      )}
                    </div>

                    {/* Image rows */}
                    {isExpanded && (
                      <div>
                        {product.images.map((img) => (
                          <div
                            key={img.id}
                            className="px-4 py-3 pl-12 border-t border-gray-100 flex items-start gap-4"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-gray-300 text-indigo-600"
                              checked={selectedImages.has(img.id)}
                              onChange={() => toggleImage(img.id)}
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt="Product"
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Live Squarespace alt text */}
                              <div className="flex items-center gap-2">
                                <StatusBadge status={img.altText ? "live" : "missing"}>
                                  {img.altText ? "Live" : "Missing"}
                                </StatusBadge>
                                <span className="text-xs text-gray-600 truncate">
                                  {img.altText || "No alt text in Squarespace"}
                                </span>
                              </div>

                              {/* App-generated alt text */}
                              {editingImages[img.id] !== undefined ? (
                                <div className="space-y-1">
                                  <textarea
                                    className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                    rows={2}
                                    value={editingImages[img.id]}
                                    onChange={(e) =>
                                      setEditingImages((prev) => ({ ...prev, [img.id]: e.target.value }))
                                    }
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveEdit(product.id, img.id)}
                                      className="text-xs font-medium text-white bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingImages((prev) => { const n = { ...prev }; delete n[img.id]; return n; })
                                      }
                                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={img.localStatus === "GENERATED" ? "generated" : "app"}>
                                    App
                                  </StatusBadge>
                                  <span className="text-xs text-gray-600 flex-1 truncate">
                                    {img.localGeneratedAltText || "No AI text yet"}
                                  </span>
                                  {img.localGeneratedAltText && (
                                    <button
                                      onClick={() =>
                                        setEditingImages((prev) => ({
                                          ...prev,
                                          [img.id]: img.localGeneratedAltText!,
                                        }))
                                      }
                                      className="text-xs text-gray-400 hover:text-indigo-600 flex-shrink-0"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              {pagination.hasNextPage && (
                <div className="px-4 py-3 border-t border-gray-200 flex justify-center">
                  <button
                    onClick={() => { setCursor(pagination.nextCursor); fetchData(pagination.nextCursor); }}
                    disabled={loading}
                    className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    Load next page →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Small UI primitives ──────────────────────────────────────────────────────

function StatCard({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {children}
    </div>
  );
}

function ProgressBar({ value, color = "indigo" }: { value: number; color?: "indigo" | "green" }) {
  const colors = { indigo: "bg-indigo-500", green: "bg-green-500" };
  return (
    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${colors[color]} transition-all`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function StatusBadge({ status, children }: { status: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    live: "bg-green-100 text-green-700",
    missing: "bg-red-100 text-red-700",
    generated: "bg-blue-100 text-blue-700",
    app: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${styles[status] ?? styles.app}`}>
      {children}
    </span>
  );
}

function ActionButton({
  onClick,
  loading,
  variant,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  variant: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const base = "text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50";
  const styles = {
    primary: `${base} bg-indigo-600 text-white hover:bg-indigo-700`,
    secondary: `${base} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`,
  };
  return (
    <button onClick={onClick} disabled={loading} className={styles[variant]}>
      {loading ? "…" : children}
    </button>
  );
}
