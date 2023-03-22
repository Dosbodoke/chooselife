import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import React from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';

const Comments = () => {
  return (
    <View>
      <View className="flex flex-row items-end justify-between">
        <Text className="text-xl font-bold">Comentários</Text>
        <TouchableOpacity>
          <Text className="text-blue-500">novo comentário</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={{ columnGap: 10, paddingBottom: 16, paddingRight: 8 }}
        showsHorizontalScrollIndicator={false}>
        <View className="h-32 w-64 rounded-md bg-gray-100 py-1 px-2" style={styles.shadow}>
          <View className="flex flex-row items-end">
            <Image
              className="mr-1 h-12 w-12 rounded-full object-contain"
              source={{
                uri: 'https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg',
              }}
            />
            <View>
              <Text className="text-base font-bold">Juan Andrade</Text>
              <Text className="text-sm">21/02/2023</Text>
            </View>
          </View>
          <Text className="text-base">
            Fita muito boa, quando andei era uma AERO 2, o bounce dela é insano!!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 2.5,

    elevation: 6,
  },
});

export default Comments;
