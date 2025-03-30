import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { unstable_setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FestivalTabs } from "./_components/festival-tabs";

type Props = {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default function Festival(props: Props) {
  const params = use(props.params);

  const { locale } = params;

  unstable_setRequestLocale(locale);
  const t = useTranslations("festival");

  return (
    <section className="w-full py-12 md:py-24 lg:py-32">
      <Image
        src="/festival-hero.png"
        fill
        className="absolute -z-10 h-full max-h-screen w-full object-cover opacity-70"
        alt="Illustration of a someone walking a Highline"
      />
      <div className="absolute inset-0 -z-10 max-h-screen bg-gradient-to-t from-background from-10%" />
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              Festival Chooselife
            </h1>
            <p className="max-w-[600px] text-secondary-foreground md:text-xl">
              {t("pageSubTitle")}
            </p>
          </div>
          <Tabs className="w-full" defaultValue="ranking">
            <TabsList className="mx-auto grid w-full max-w-md grid-cols-2">
              {/* <TabsTrigger value="schedule">Schedule</TabsTrigger> */}
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="highlines">Highlines</TabsTrigger>
            </TabsList>
            {/* <TabsContent value="schedule">
              <div>foo</div>
            </TabsContent> */}
            <Suspense
              fallback={
                <div className="mt-12 grid w-full place-items-center">
                  <Loader2 className="h-20 w-20 animate-spin text-primary"></Loader2>
                </div>
              }
            >
              <FestivalTabs />
            </Suspense>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
