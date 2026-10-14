import { PageHeader } from './page-header';

/** Simple long-form page shell used by the static content routes. */
export function ProsePage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-3xl">
      <PageHeader title={title} description={intro} />
      <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </article>
  );
}
