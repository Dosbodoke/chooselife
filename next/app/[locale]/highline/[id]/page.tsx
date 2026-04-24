import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next/types";
import { cache } from "react";

import { getHighline } from "@/app/actions/getHighline";

import OpenInAPP from "./_components/open-in-app";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://chooselife.club";

type Props = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getHigh = cache(async ({ id }: { id: string }) => {
  const result = await getHighline({ id: [id] });
  return result.data;
});

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, id } = await params;

  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) {
    return { title: "Highline Not Found" };
  }
  const highline = highlines[0];

  const localePrefix = locale === "pt" ? "" : `/${locale}`;
  const canonicalPath = `${localePrefix}/highline/${id}`;
  const title = highline.name || `Highline: ${id}`;
  const description =
    highline.description ||
    `Highline with height ${highline.height}m and length ${highline.length}m`;
  const imageParams = new URLSearchParams({
    id,
    title,
  });

  if (highline.cover_image) {
    imageParams.set("cover", highline.cover_image);
  }

  if (highline.height) {
    imageParams.set("height", Math.round(highline.height).toString());
  }

  if (highline.length) {
    imageParams.set("length", Math.round(highline.length).toString());
  }

  const imageUrl = `${BASE_URL}/api/highline-og?${imageParams.toString()}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}${canonicalPath}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}${canonicalPath}`,
      siteName: "ChooseLife",
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 630,
          alt: highline.name || `Highline: ${id}`,
          type: "image/png",
        },
      ],
      locale: locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function Highline({ params }: Props) {
  const { id } = await params;
  const highlines = await getHigh({ id });

  if (!highlines || highlines.length === 0) {
    return notFound();
  }
  const highline = highlines[0];

  return <OpenInAPP highline={highline} />;
}
