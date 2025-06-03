import debounce from "lodash.debounce";
import React from "react";

const DEBOUNCE_DELAY = 750;

export const useDebounceValue = (
  value: string,
  delay: number = DEBOUNCE_DELAY
) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  const debouncedSetValue = React.useMemo(
    () => debounce((newValue: string) => setDebouncedValue(newValue), delay),
    [delay]
  );

  React.useEffect(() => {
    debouncedSetValue(value);
    return () => debouncedSetValue.cancel();
  }, [value, debouncedSetValue]);

  return debouncedValue;
};
