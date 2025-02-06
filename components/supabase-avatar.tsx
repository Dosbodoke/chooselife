import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { useProfile } from '~/hooks/use-profile';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

import { Skeleton } from './ui/skeleton';

const _GOOGLE_URL_REGEX =
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*google(?:usercontent)?\.com/;

export const SupabaseAvatar: React.FC<{
  size?: number;
  profileID?: string;
  // URL can be passed directly, it will have priority over the profile ID
  URL?: string;
}> = ({ size = 8, profileID, URL }) => {
  const [imageURL, setImageURL] = useState<string | undefined>(URL);
  const { data, isPending } = useProfile(profileID);

  React.useEffect(() => {
    if (!URL && data?.profile_picture) {
      // Image is coming from google, no need to get from storage
      if (_GOOGLE_URL_REGEX.test(data?.profile_picture)) {
        setImageURL(data.profile_picture);
        return;
      }

      const { data: avatarData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.profile_picture);

      if (avatarData) {
        setImageURL(avatarData.publicUrl);
      }
    }
  }, [data?.profile_picture]);

  if (profileID && isPending) {
    return <Skeleton className={`size-${size} rounded-full`} />;
  }

  return (
    <Avatar className={`size-${size}`} alt="Foto do perfil">
      <AvatarImage source={{ uri: URL || imageURL }} />
      <AvatarFallback>
        <Text>{getShortName(data?.name || '')}</Text>
      </AvatarFallback>
    </Avatar>
  );
};

export const AvatarUploader: React.FC<{
  onUpload?: (filePath: string) => void;
}> = ({ onUpload }) => {
  const [uploading, setUploading] = React.useState(false);

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
        return;
      }

      const image = result.assets[0];

      if (!image.uri) {
        throw new Error('No image uri!'); // Realistically, this should never happen, but just in case...
      }

      const arraybuffer = await fetch(image.uri).then((res) =>
        res.arrayBuffer(),
      );

      const fileExt = image.uri?.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const path = `${Date.now()}.${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arraybuffer, {
          contentType: image.mimeType ?? 'image/jpeg',
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
  );
};

function getShortName(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/);
  const shortName = nameParts
    .filter((part) => part.length > 0) // Exclude empty parts in case of multiple spaces
    .map((part) => part[0].toUpperCase()) // Get the first letter and convert to uppercase
    .filter((letter, index, array) => index === 0 || index === array.length - 1) // Get first and last initials
    .join('');
  return shortName;
}
