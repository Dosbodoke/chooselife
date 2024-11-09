import * as React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import * as AvatarPrimitive from "@rn-primitives/avatar";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import { LucideIcon } from "~/lib/icons/lucide-icon";
import { Button } from "./button";

const AvatarPrimitiveRoot = AvatarPrimitive.Root;
const AvatarPrimitiveImage = AvatarPrimitive.Image;
const AvatarPrimitiveFallback = AvatarPrimitive.Fallback;

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitiveRoot>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitiveRoot>
>(({ className, ...props }, ref) => (
  <AvatarPrimitiveRoot
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitiveRoot.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitiveImage>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitiveImage>
>(({ className, ...props }, ref) => (
  <AvatarPrimitiveImage
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitiveImage.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitiveFallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitiveFallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitiveFallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitiveFallback.displayName;

function getShortName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const shortName = nameParts
    .filter((part) => part.length > 0) // Exclude empty parts in case of multiple spaces
    .map((part) => part[0].toUpperCase()) // Get the first letter and convert to uppercase
    .filter((letter, index, array) => index === 0 || index === array.length - 1) // Get first and last initials
    .join("");
  return shortName;
}

const SupabaseAvatar = ({
  profilePicture,
  name,
  size,
  onUpload,
}: {
  profilePicture: string | undefined;
  name: string;
  size?: number;
  onUpload?: (filePath: string) => void;
}) => {
  const [imageUrl, setImageUrl] = React.useState(profilePicture);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    const googleUrlRegex =
      /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*google(?:usercontent)?\.com/;

    if (profilePicture && !googleUrlRegex.test(profilePicture)) {
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(profilePicture);

      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
      }
    }
  }, [profilePicture]);

  async function uploadAvatar() {
    try {
      setUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Restrict to only images
        allowsMultipleSelection: false, // Can only select one image
        allowsEditing: true, // Allows the user to crop / rotate their photo before uploading it
        quality: 1,
        exif: false, // We don't want nor need that data.
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("User cancelled image picker.");
        return;
      }

      const image = result.assets[0];
      console.log("Got image", image);

      if (!image.uri) {
        throw new Error("No image uri!"); // Realistically, this should never happen, but just in case...
      }

      const arraybuffer = await fetch(image.uri).then((res) =>
        res.arrayBuffer()
      );

      const fileExt = image.uri?.split(".").pop()?.toLowerCase() ?? "jpeg";
      const path = `${Date.now()}.${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arraybuffer, {
          contentType: image.mimeType ?? "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      if (onUpload) {
        onUpload(data.path);
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message);
      } else {
        throw error;
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="flex-row gap-2 relative items-center">
      <Avatar
        className={size ? `size-${size}` : `size-16`}
        alt="Foto do perfil"
      >
        <AvatarImage source={{ uri: imageUrl }} />
        <AvatarFallback>
          <Text>{getShortName(name)}</Text>
        </AvatarFallback>
      </Avatar>
      {onUpload ? (
        <Button
          className="flex-row items-center justify-center gap-1"
          variant="outline"
          onPress={uploadAvatar}
          disabled={uploading}
        >
          <LucideIcon
            name="Camera"
            className="w-4 h-4 text-black"
            strokeWidth={2}
          />
          <Text>Trocar foto</Text>
        </Button>
      ) : null}
    </View>
  );
};

export { Avatar, AvatarFallback, AvatarImage, SupabaseAvatar };
