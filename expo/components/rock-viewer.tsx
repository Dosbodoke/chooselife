'use dom';

import '@google/model-viewer';
import { Asset } from 'expo-asset';
import React from 'react';

const modelUrl = Asset.fromModule(
  // Metro needs a static require so the GLB is included in the app bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../assets/models/morro-do-macaco.glb'),
).uri;

type RockViewerProps = { dom?: import('expo/dom').DOMProps };

const RockViewer: React.FC<RockViewerProps> = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        background: '#e9e7e2',
        overflow: 'hidden',
      }}
    >
      {React.createElement('model-viewer', {
        src: modelUrl,
        alt: 'Textured 3D scan of the Morro do Macaco climbing rock',
        'camera-controls': '',
        'environment-image': 'neutral',
        'shadow-intensity': '0.4',
        'interaction-prompt': 'auto',
        style: { width: '100%', height: '100%' },
      })}
    </div>
  );
};

export default RockViewer;
