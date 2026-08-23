import { HomeAgentContent } from "./_components/HomeAgentContent";
import HomeInteractive from "./_components/HomeInteractive";
import { HeroPromoCard } from "./_components/hero-promo-card";

type HomePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

const BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club"
).replace(/\/+$/, "");
const APPLE_APP_ID = process.env.NEXT_PUBLIC_APPLE_APP_ID || "6745024708";
const APP_SCHEME = process.env.NEXT_PUBLIC_APP_SCHEME || "com.bodok.chooselife";
const OFFICIAL_REPOSITORY = "https://github.com/Dosbodoke/chooselife";

function createStructuredData(locale: string) {
  const isEnglish = locale === "en";
  const description = isEnglish
    ? "Chooselife is a highline app and community hub for discovering lines, exploring their locations, recording walks, and finding events."
    : "O Chooselife é um aplicativo e ponto de encontro para descobrir highlines, explorar seus locais, registrar rolês e encontrar eventos.";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "Chooselife",
        url: BASE_URL,
        logo: `${BASE_URL}/icon.png`,
        sameAs: [OFFICIAL_REPOSITORY],
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        name: "Chooselife",
        url: BASE_URL,
        description,
        inLanguage: isEnglish ? "en" : "pt-BR",
        publisher: { "@id": `${BASE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${BASE_URL}/#application`,
        name: "Chooselife",
        description,
        url: BASE_URL,
        applicationCategory: "SportsApplication",
        operatingSystem: "iOS, Android, Web",
        downloadUrl: [
          `https://apps.apple.com/app/id${APPLE_APP_ID}`,
          `https://play.google.com/store/apps/details?id=${APP_SCHEME}`,
        ],
        sameAs: [OFFICIAL_REPOSITORY],
      },
    ],
  };
}

export default async function HomePage({
  params,
  searchParams,
}: HomePageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const view = resolvedSearchParams.view;
  const mapOpen = Array.isArray(view) ? view[0] === "map" : view === "map";
  const structuredData = JSON.stringify(createStructuredData(locale)).replace(
    /</g,
    "\\u003c",
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      {!mapOpen ? <HeroPromoCard /> : null}
      <HomeInteractive />
      {!mapOpen ? <HomeAgentContent locale={locale} /> : null}
    </>
  );
}
