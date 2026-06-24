import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { Truck } from "lucide-react";

export function Login() {
  const { signIn, loading } = useAuth();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-brand-300">
          Ultimate Tech Distributors LLC
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Build an order in
            <br />
            under a minute.
          </h1>
          <p className="mt-4 max-w-sm text-ink-300">
            Search a customer, scan or type products, set delivery priority, submit.
            Every order keeps its number and prints clean.
          </p>
        </div>
        <div className="flex gap-6 font-mono text-sm text-ink-400">
          <span>
            <span className="text-white">379</span> customers
          </span>
          <span>
            <span className="text-white">1,013</span> products
          </span>
          <span>
            <span className="text-white">7,935</span> orders
          </span>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
            <Truck size={26} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900">
            Order System
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Sign in with your company Google account.
          </p>

          <Button
            size="lg"
            block
            className="mt-8"
            loading={loading}
            onClick={signIn}
          >
            <GoogleMark />
            Continue with Google
          </Button>

          <p className="mt-6 text-xs text-ink-400">
            New accounts need admin approval before access is granted.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C39.9 36.9 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
