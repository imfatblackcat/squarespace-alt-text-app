import Link from "next/link";

export default function ConnectPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SpectoAI Alt Text</h1>
          <p className="mt-2 text-gray-500 text-sm">
            AI-powered alt text generation for your Squarespace store.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">
          <div className="space-y-3 text-sm text-gray-600">
            <Feature icon="🔍" text="GPT-4o vision analyzes every product image" />
            <Feature icon="⚡" text="Bulk generate alt text in seconds" />
            <Feature icon="✏️" text="Review, edit, then apply to Squarespace" />
            <Feature icon="🌍" text="8 languages supported" />
            <Feature icon="🆓" text="100 free credits to start" />
          </div>

          {searchParams.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(searchParams.error)}
            </div>
          )}

          <Link
            href="/api/auth/connect"
            className="block w-full bg-indigo-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors text-center"
          >
            Connect Squarespace Store →
          </Link>

          <p className="text-xs text-gray-400">
            You&apos;ll be redirected to Squarespace to authorize access. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-left">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
