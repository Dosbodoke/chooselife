"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import useSupabaseBrowser from "@/utils/supabase/client";

interface HighlinePropsImage {
  coverImageId: string | null;
}

function HighlineImage({ coverImageId }: HighlinePropsImage) {
  const supabase = useSupabaseBrowser();
  const [loaded, setLoaded] = useState(false);

  if (!coverImageId) {
    return (
      <div className="h-full w-full bg-muted drop-shadow">
        <Image
          src={"/chooselife-black.png"}
          alt="Chooselife Icon"
          fill
          priority
          className="object-contain object-center dark:invert"
        />
      </div>
    );
  }

  const {
    data: { publicUrl: URL },
  } = supabase.storage.from("images").getPublicUrl(`${coverImageId}`);

  return (
    <div className="h-full w-full drop-shadow">
      {!loaded ? (
        <div className="flex h-full items-center justify-center space-x-2 opacity-70 dark:invert">
          <span className="sr-only">Loading...</span>
          <div className="h-8 w-8 animate-bounce rounded-full bg-black [animation-delay:-0.3s]"></div>
          <div className="h-8 w-8 animate-bounce rounded-full bg-black [animation-delay:-0.15s]"></div>
          <div className="h-8 w-8 animate-bounce rounded-full bg-black"></div>
        </div>
      ) : null}
      <Image
        src={URL}
        alt="Image of the Highline"
        fill
        onLoad={() => setLoaded(true)}
        className={cn(loaded ? "object-cover object-center" : "opacity-0")}
      />
    </div>
  );
}

export default HighlineImage;
