import { Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { highlineNameTag, highlineTransition } from './shared-transition';

/**
 * The highline's name in white over its photo. The card and the highline
 * screen's cover render the same one, so the name flies between them as is:
 * a change of size or color would jump when it lands.
 */
export const HighlineName: React.FC<{
  highlineID: string;
  name: string;
  /** Only one per highline on a screen may set it. */
  sharedTransition?: boolean;
}> = ({ highlineID, name, sharedTransition }) => (
  <Animated.View
    sharedTransitionTag={
      sharedTransition ? highlineNameTag(highlineID) : undefined
    }
    sharedTransitionStyle={highlineTransition}
  >
    <Text
      className="text-xl font-bold text-white leading-tight"
      numberOfLines={2}
      style={{
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }}
    >
      {name}
    </Text>
  </Animated.View>
);
