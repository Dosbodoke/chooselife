import { getAgentHomeContent } from "@/lib/agent-content";

type HomeAgentContentProps = {
  locale: string;
};

export function HomeAgentContent({ locale }: HomeAgentContentProps) {
  const content = getAgentHomeContent(locale);

  return (
    <section aria-labelledby="home-agent-content-heading" className="sr-only">
      <h2 id="home-agent-content-heading">{content.heading}</h2>
      <p>{content.summary}</p>
      {content.sections.map(({ heading, body }) => (
        <article key={heading}>
          <h3>{heading}</h3>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}
