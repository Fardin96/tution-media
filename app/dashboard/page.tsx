import Image from "next/image";
import { requireSession } from "@/lib/auth.server";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const user = await requireSession();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-neutral-off-white)] px-6 py-12">
      <div className="w-full max-w-sm rounded-[24px] bg-[var(--color-neutral-white)] p-8 text-center shadow-[0_8px_30px_rgb(0_0_0/0.06)] sm:p-10">
        {user.picture ? (
          <Image
            src={user.picture}
            alt={user.name}
            width={80}
            height={80}
            unoptimized
            className="mx-auto size-20 rounded-full object-cover outline outline-1 outline-[oklch(0_0_0/0.1)]"
          />
        ) : (
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] text-2xl font-semibold text-[var(--color-primary-core)]">
            {user.name.charAt(0)}
          </div>
        )}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)]">
          Welcome back, {user.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {user.email}
        </p>
        <p className="mt-1 text-xs font-medium tracking-wide text-[var(--color-text-secondary)] uppercase">
          {user.role}
        </p>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
