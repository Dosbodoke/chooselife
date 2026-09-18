import { Fit, RiveView, useRiveFile } from '@rive-app/react-native';
import rankingPodium from '~/assets/animations/ranking-podium.riv';
import { useState } from 'react';
import { View } from 'react-native';

import {
  podiumSteps,
  StaticPodiumStep,
  type PodiumStepProps,
} from './podium-step.shared';

function AnimatedPodiumStep({ variant }: PodiumStepProps) {
  const { riveFile, error, isLoading } = useRiveFile(rankingPodium);
  const [failed, setFailed] = useState(false);
  const step = podiumSteps[variant];

  if (isLoading)
    return (
      <View
        testID={`ranking-podium-loading-${variant}`}
        style={{ width: '100%', height: step.height }}
      />
    );

  if (error || failed || !riveFile)
    return <StaticPodiumStep variant={variant} />;

  return (
    <RiveView
      testID={`ranking-podium-${variant}`}
      file={riveFile}
      artboardName={step.artboard}
      stateMachineName="Podium"
      fit={Fit.Fill}
      autoPlay
      onError={() => setFailed(true)}
      style={{ width: '100%', height: step.height }}
    />
  );
}

export function PodiumStep(props: PodiumStepProps) {
  return props.reduceMotion ? (
    <StaticPodiumStep variant={props.variant} />
  ) : (
    <AnimatedPodiumStep {...props} />
  );
}
