import { ImageUploadSvg } from '@src/assets';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';

const ImageInput = () => {
  const [images, setImages] = useState<string[]>([]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((asset) => asset.uri)]);
    }
  };

  return (
    <ScrollView horizontal className="my-2">
      {images.map((uri) => (
        <View key={uri} className="mr-2 h-64 w-64 rounded-xl border-2 border-gray-200">
          <Image className="h-full w-full rounded-xl" source={{ uri }} />
        </View>
      ))}
      <TouchableOpacity
        onPress={pickImage}
        className="mr-2 flex h-64 w-64 justify-center rounded-xl border-2 border-gray-300">
        <View className="h-20">
          <ImageUploadSvg color="#2196f3" className="fill-sky-500" />
        </View>
        <Text className="mt-4 text-center text-lg text-neutral-500">selecionar imagem</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ImageInput;
