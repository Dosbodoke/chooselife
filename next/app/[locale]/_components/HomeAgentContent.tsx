import { getAgentHomeContent } from "@/lib/agent-content";

type HomeAgentContentProps = {
  locale: string;
};

export function HomeAgentContent({ locale }: HomeAgentContentProps) {
  const content = getAgentHomeContent(locale);

  return (
    <section
      aria-labelledby="home-agent-content-heading"
      className="relative z-10 mx-auto mt-8 w-full max-w-5xl px-4 pb-16 md:mt-12"
    >
      <div className="rounded-3xl border border-border/60 bg-background/85 p-6 shadow-sm backdrop-blur-sm md:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Chooselife
        </p>
        <h2
          id="home-agent-content-heading"
          className="text-2xl font-bold tracking-tight md:text-3xl"
        >
          {content.heading}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
          {content.summary}
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {content.sections.map(({ heading, body }) => (
            <article key={heading}>
              <h3 className="text-lg font-semibold">{heading}</h3>
              <p className="mt-2 leading-7 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
