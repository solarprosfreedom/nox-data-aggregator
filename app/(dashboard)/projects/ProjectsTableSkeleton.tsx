export default function ProjectsTableSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="mb-3 h-8 rounded bg-slate-100" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="mb-2 h-10 rounded bg-slate-50" />
      ))}
    </div>
  );
}
