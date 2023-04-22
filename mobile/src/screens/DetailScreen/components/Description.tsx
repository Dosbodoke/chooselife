import React, { useState, useRef, useEffect } from 'react';
import { Text, View, TouchableOpacity, type TextLayoutEventData } from 'react-native';
import { type NativeSyntheticEvent } from 'react-native';

interface Props {
  description: string;
}

const DEFAULT_NUMBER_OF_LINES = 2;

const Description = ({ description }: Props) => {
  const [limitLines, setLimitLines] = useState(false); // To show your remaining Text
  const [showMore, setShowMore] = useState(false); // To show or hide the Read More and Less button

  function toggleNumberOfLines() {
    setLimitLines((prev) => !prev);
  }

  function onTextLayout(e: NativeSyntheticEvent<TextLayoutEventData>) {
    const { lines } = e.nativeEvent;
    if (!showMore && lines.length > DEFAULT_NUMBER_OF_LINES) {
      setShowMore(true);
      toggleNumberOfLines();
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={toggleNumberOfLines} disabled={!showMore}>
        <Text
          onTextLayout={onTextLayout}
          numberOfLines={limitLines ? DEFAULT_NUMBER_OF_LINES : undefined}>
          {description}
        </Text>
        {showMore && <Text className="text-blue-500">{limitLines ? 'Ver mais' : 'Menos'}</Text>}
      </TouchableOpacity>
    </View>
  );
};

export default Description;
