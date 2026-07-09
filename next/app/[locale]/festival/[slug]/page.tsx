import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Locales } from "@/i18n/routing";
import { createSupabaseClient } from "@/utils/supabase/server";

import { FestivalTabs } from "../_components/festival-tabs";

type Props = {
  params: Promise<{ locale: Locales; slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function Festival({ params }: Props) {
  const { locale, slug } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("festival");
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: festival } = await supabase
    .from("festival")
    .select("slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!festival) {
    notFound();
  }

  return (
    <section className="relative w-full py-12 md:py-24 lg:py-32">
      <Image
        src="/festival-hero.png"
        fill
        className="absolute -z-10 h-full max-h-screen w-full object-cover opacity-70"
        alt="Illustration of a someone walking a Highline"
      />
      <div className="absolute inset-0 -z-10 max-h-screen bg-gradient-to-t from-slate-900 from-10%" />
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              {festival.name}
            </h1>
            <p className="max-w-[600px] text-secondary-foreground md:text-xl">
              {t("pageSubTitle")}
            </p>
          </div>
          <Tabs className="mx-auto w-full" defaultValue="highlines">
            <TabsList className="mx-auto grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="highlines">{t("tabs.highlines")}</TabsTrigger>
              <TabsTrigger value="ranking">{t("tabs.ranking")}</TabsTrigger>
            </TabsList>
            <FestivalTabs festivalSlug={festival.slug} userId={user?.id} />
          </Tabs>
        </div>
      </div>
    </section>
  );
}
