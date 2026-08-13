import LoginForm from "@/components/LoginForm";
import ThemeToggle from "@/components/ThemeToggle";
import { safeReturnPath } from "@/lib/auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = safeReturnPath(typeof params.next === "string" ? params.next : undefined);
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <div className="absolute -left-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl sm:p-10">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl bg-gradient-to-br from-accent to-accent-secondary shadow-accent" />
          <span className="font-display text-2xl">Today</span>
        </div>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">Private workspace</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">Welcome back.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter your owner password to access your tasks.</p>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
