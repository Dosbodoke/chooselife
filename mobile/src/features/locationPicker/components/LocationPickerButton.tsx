import { PlusSvg } from '@src/assets';
import { useAppDispatch, useAppSelector } from '@src/redux/hooks';
import { TouchableOpacity } from 'react-native';

import { selectLocationPicker, showLocationPicker, callSetPoint } from '../locationPickerSlice';

const LocationPickerButton = () => {
  const dispatch = useAppDispatch();
  const locationPicker = useAppSelector(selectLocationPicker);

  function getIconColor(): 'fill-slate-800' | 'fill-yellow-400' | 'fill-green-400' {
    if (locationPicker.anchorA && locationPicker.stage === 'picking') return 'fill-green-400';
    if (locationPicker.stage === 'picking') return 'fill-yellow-400';
    return 'fill-slate-800';
  }

  return (
    <TouchableOpacity
      className="w-8 h-8"
      onPress={() => {
        if (locationPicker.stage === 'hidden') {
          dispatch(showLocationPicker());
        } else if (locationPicker.stage === 'picking') {
          dispatch(callSetPoint());
        }
      }}>
      <PlusSvg className={getIconColor()} />
    </TouchableOpacity>
  );
};

export default LocationPickerButton;
