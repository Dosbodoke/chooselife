"use client";

import { useMutation } from "@tanstack/react-query";
import { HeartIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useSupabaseBrowser from "@/utils/supabase/client";
import { useLoginModal } from "@/utils/useLoginModal";

export function FavoriteHighline({
  isFavorite,
  id,
}: {
  isFavorite: boolean;
  id: string;
}) {
  const supabase = useSupabaseBrowser();
  const [favorite, setFavorite] = useState(isFavorite);
  const { toggleLoginModal } = useLoginModal();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toggleLoginModal("open");
        throw new Error("User not logged in");
      }

      if (favorite) {
        const { error } = await supabase
          .from("favorite_highline")
          .delete()
          .match({ highline_id: id, profile_id: user.id });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("favorite_highline")
          .insert({ highline_id: id, profile_id: user.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setFavorite((prev) => !prev);
    },
  });

  return (
    <Button
      className="absolute right-2 top-2 z-10"
      size="icon"
      variant="outline"
      type="submit"
      onClick={() => mutate()}
      disabled={isPending}
    >
      <HeartIcon
        className={cn(
          "h-6 w-6",
          favorite
            ? "fill-red-500 text-red-500 dark:fill-red-600 dark:text-red-600"
            : null
        )}
      />
    </Button>
  );
}
