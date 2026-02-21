"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PLANS, PLAN_ORDER, isUpgrade } from "@/lib/plans";

export default function Pricing() {
  const [currentPlan, setCurrentPlan] = useState("FREE");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      // Settings doesn't return plan, fetch from products endpoint
    });
    fetch("/api/products").then((r) => r.json()).then((d) => {
      if (d.store?.plan) setCurrentPlan(d.store.plan);
    });
  }, []);

  const handleSelect = async (planCode: string) => {
    if (planCode === currentPlan) return;
    setLoading(true);

    if (planCode === "FREE") {
      await fetch("/api/stripe/portal", { method: "POST" });
      setLoading(false);
      return;
    }

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planCode }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setMessage(data.error ?? "Failed to start checkout.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">SpectoAI — Alt Text</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/settings" className="text-gray-600 hover:text-gray-900">Settings</Link>
            <Link href="/pricing" className="font-medium text-indigo-600">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Pricing Plans</h2>
          <p className="text-sm text-gray-500 mt-2">Choose the plan that fits your store size.</p>
        </div>

        {message && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {PLAN_ORDER.map((code) => {
            const plan = PLANS[code];
            const isCurrent = currentPlan === code;
            const upgrade = isUpgrade(currentPlan, code);

            return (
              <div
                key={code}
                className={`bg-white rounded-xl border p-6 space-y-4 relative ${
                  plan.recommended && !isCurrent
                    ? "border-indigo-400 shadow-md"
                    : "border-gray-200"
                }`}
              >
                {plan.recommended && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  {plan.price > 0 && <span className="text-sm text-gray-400 mb-1">/mo</span>}
                </div>

                <p className="text-xs text-gray-500">
                  {plan.credits.toLocaleString()} credits
                  {plan.price === 0 ? " (one-time)" : "/month"}
                </p>

                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(code)}
                  disabled={isCurrent || loading}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    isCurrent
                      ? "bg-gray-100 text-gray-400 cursor-default"
                      : plan.recommended
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isCurrent
                    ? "Current Plan"
                    : loading
                    ? "…"
                    : upgrade
                    ? `Upgrade to ${plan.name}`
                    : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
