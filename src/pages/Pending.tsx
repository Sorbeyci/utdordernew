import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { Clock } from "lucide-react";

export function Pending() {
  const { profile, signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600">
          <Clock size={26} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-ink-900">Waiting for approval</h1>
        <p className="mt-2 text-sm text-ink-500">
          Your account ({profile?.email}) is set up but needs an admin to grant access.
          You'll be able to sign in normally once approved.
        </p>
        <Button variant="secondary" className="mt-6" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
