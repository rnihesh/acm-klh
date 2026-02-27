import Sidebar from "./Sidebar";

export default function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen c-bg-main">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-semibold c-text mb-1">{title}</h1>
          <p className="c-text-3 text-sm mb-8">{description}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
