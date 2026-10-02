export type AgentLocale = "pt" | "en";

export type AgentHomeContent = {
  heading: string;
  summary: string;
  sections: readonly {
    heading: string;
    body: string;
  }[];
};

const HOME_CONTENT: Record<AgentLocale, AgentHomeContent> = {
  en: {
    heading: "Chooselife: the highline community and map",
    summary:
      "Chooselife is a highline app and community hub for discovering lines, exploring their locations, and keeping a record of the walks that matter to you. It brings highline information, events, and community features into one place for people who practice highline and slackline.",
    sections: [
      {
        heading: "Discover highlines",
        body: "Use the highline map and searchable list to find lines shared by the community. Open a line to review its name, height, length, image, description, access notes, and other details supplied by its contributors.",
      },
      {
        heading: "Record every walk",
        body: "After a session, register walks and connect them with your profile. Chooselife can surface your history, distance, full lines, and rankings so progress remains tied to the places and people that make the sport meaningful.",
      },
      {
        heading: "Find events and community sessions",
        body: "The events area collects upcoming slackline and highline gatherings. Browse event information, then use the website or app to keep track of the sessions and festivals you want to attend.",
      },
      {
        heading: "Use the Chooselife app",
        body: "The website is the public front door to Chooselife. The mobile app adds the account experience, favorites, profiles, and walk-registration tools. Use the download page to find the current iOS and Android app links.",
      },
    ],
  },
  pt: {
    heading: "Chooselife: comunidade e mapa de highline",
    summary:
      "O Chooselife é um aplicativo e ponto de encontro da comunidade de highline para descobrir vias, explorar seus locais e registrar os rolês que fazem parte da sua história. A plataforma reúne informações de highlines, eventos e recursos da comunidade em um só lugar para quem pratica highline e slackline.",
    sections: [
      {
        heading: "Descubra highlines",
        body: "Use o mapa de highlines e a lista pesquisável para encontrar vias compartilhadas pela comunidade. Abra uma via para consultar nome, altura, comprimento, imagem, descrição, informações de acesso e outros detalhes fornecidos por quem conhece o local.",
      },
      {
        heading: "Registre cada rolê",
        body: "Depois de uma sessão, registre os rolês e conecte-os ao seu perfil. O Chooselife reúne histórico, distância, cadenas, full lines e rankings para que a evolução continue ligada aos lugares e às pessoas que tornam o esporte especial.",
      },
      {
        heading: "Encontre eventos e encontros",
        body: "A área de eventos reúne encontros de slackline e highline. Consulte as informações de cada evento e use o site ou o aplicativo para acompanhar as sessões e festivais que você quer visitar.",
      },
      {
        heading: "Use o aplicativo Chooselife",
        body: "O site é a porta de entrada pública do Chooselife. O aplicativo acrescenta a experiência de conta, favoritos, perfis e registro de rolês. Acesse a página de download para encontrar os links atuais para iOS e Android.",
      },
    ],
  },
};

export function resolveAgentLocale(locale: string | undefined): AgentLocale {
  return locale === "en" ? "en" : "pt";
}

export function getAgentHomeContent(
  locale: string | undefined,
): AgentHomeContent {
  return HOME_CONTENT[resolveAgentLocale(locale)];
}

export function getAgentHomeMarkdown(
  locale: string | undefined,
  baseUrl: string,
): string {
  const resolvedLocale = resolveAgentLocale(locale);
  const content = getAgentHomeContent(resolvedLocale);
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const localePrefix = resolvedLocale === "en" ? "/en" : "";

  const sections = content.sections.flatMap(({ heading, body }) => [
    `## ${heading}`,
    "",
    body,
    "",
  ]);

  return [
    `# ${content.heading}`,
    "",
    `> ${content.summary}`,
    "",
    ...sections,
    "## Explore Chooselife",
    "",
    `- [Homepage](${normalizedBaseUrl}${localePrefix}/): Discover highlines and community resources.`,
    `- [Events](${normalizedBaseUrl}${localePrefix}/events): Browse upcoming highline and slackline events.`,
    `- [Download the app](${normalizedBaseUrl}${localePrefix}/download): Find the current mobile app links.`,
    `- [Privacy policy](${normalizedBaseUrl}${localePrefix}/privacy): Read the site's privacy policy.`,
    `- [Sitemap](${normalizedBaseUrl}/sitemap.xml): Find the site's indexed URLs.`,
    `- [Agent index](${normalizedBaseUrl}/llms.txt): Read the curated machine-readable site overview.`,
    "",
  ].join("\n");
}
