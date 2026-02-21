"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Settings() {
  const [altTextStyle, setAltTextStyle] = useState("balanced");
  const [language, setLanguage] = useState("en");
  const [autoProcess, setAutoProcess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.settings) {
        setAltTextStyle(d.settings.altTextStyle ?? "balanced");
        setLanguage(d.settings.defaultLanguage ?? "en");
        setAutoProcess(d.settings.autoProcess ?? false);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altTextStyle, defaultLanguage: language, autoProcess }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const styleExamples: Record<string, string> = {
    concise: '"Navy blue merino wool crew neck sweater with cable-knit pattern"',
    balanced:
      '"A folded navy blue wool sweater on a white surface. The ribbed collar and cable-knit pattern across the chest are clearly visible."',
    detailed:
      '"A premium navy blue merino wool sweater neatly folded on a clean white background. The sweater features a classic crew neck with ribbed detailing along the collar, cuffs, and hem. A subtle cable-knit pattern runs across the chest."',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">SpectoAI — Alt Text</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/settings" className="font-medium text-indigo-600">Settings</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure how SpectoAI generates alt text for your product images.</p>
        </div>

        {/* Alt text style */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Alt Text Style</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "concise", label: "Concise", desc: "50–100 chars · SEO-focused" },
              { value: "balanced", label: "Balanced", desc: "120–200 chars · Recommended" },
              { value: "detailed", label: "Detailed", desc: "200–350 chars · Accessibility" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAltTextStyle(opt.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  altTextStyle === opt.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 italic border border-gray-200">
            <span className="font-medium not-italic text-gray-500 block mb-1">Example output:</span>
            {styleExamples[altTextStyle]}
          </div>
        </section>

        {/* Language */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Default Language</h3>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full max-w-xs"
          >
            {[
              ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"],
              ["it", "Italian"], ["pt", "Portuguese"], ["pl", "Polish"], ["ja", "Japanese"],
            ].map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </section>

        {/* Auto-process */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Auto-process new products</h3>
              <p className="text-xs text-gray-500 mt-1">
                Automatically generate and apply alt text when new products are added to your store.
              </p>
            </div>
            <button
              onClick={() => setAutoProcess(!autoProcess)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoProcess ? "bg-indigo-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoProcess ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </main>
    </div>
  );
}
