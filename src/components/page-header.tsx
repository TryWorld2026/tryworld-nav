export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-5">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
