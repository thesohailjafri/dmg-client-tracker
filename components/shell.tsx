import { Nav } from "@/components/nav";

export function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="mx-auto w-full max-w-5xl px-6 pb-24">
        <header className="pt-10 pb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </header>
        <main className="flex flex-col gap-8">{children}</main>
      </div>
    </>
  );
}
