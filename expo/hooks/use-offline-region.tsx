import Mapbox, { offlineManager } from '@rnmapbox/maps';
import { useCallback, useEffect } from 'react';

const CHOOSELIFE_BOUNDS: [number, number, number, number] = [
  -47.47092834048479, // sw long
  -13.8732788197745, // sw lat
  -47.44604833769594, // ne long
  -13.841165559933813, // ne lat
];
const PACK_NAME = 'chooselife';

export const useOfflineRegion = async () => {
  const handleDownloadRegion = useCallback(async () => {
    try {
      const packs = await Mapbox.offlineManager.getPacks();
      const existingPack = packs.find((p) => p.name === PACK_NAME);

      if (existingPack) {
        console.log('Pack already downloaded');
        return;
      }

      await offlineManager.createPack(
        {
          name: PACK_NAME,
          styleURL: Mapbox.StyleURL.SatelliteStreet,
          minZoom: 14,
          maxZoom: 20,
          bounds: [
            [CHOOSELIFE_BOUNDS[2], CHOOSELIFE_BOUNDS[3]],
            [CHOOSELIFE_BOUNDS[0], CHOOSELIFE_BOUNDS[1]],
          ],
        },
        (pack, status) => {
          if (status.percentage === 100) {
            console.log(`Finished downloading ${pack.name}`);
          }
        },
      );
    } catch (error) {
      console.error('Error downloading region:', error);
    }

    return true;
  }, []);

  useEffect(() => {
    handleDownloadRegion();
  }, []);
};
