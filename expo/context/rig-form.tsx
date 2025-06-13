import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { getWebbingName } from '~/hooks/use-webbings';

import { webbingSchema } from '~/components/webbing-input';

// SCHEMA related schema and types
const webbingSchemaWithPreffiled = webbingSchema.extend({
  // Id of the webbing from "webbing" table
  webbingId: z.string().optional(),
  tagName: z.string(),
});
const rigSchema = z.object({
  webbing: z.object({
    main: z.array(webbingSchemaWithPreffiled),
    backup: z.array(webbingSchemaWithPreffiled),
  }),
  rigDate: z.date(),
});
export type RigSchema = z.infer<typeof rigSchema>;
export type WebbingSchemaWithPreffiled = RigSchema['webbing']['main'][number];
// React hook form `useFieldArray` add's id to each item in the array
export type WebbingWithId = WebbingSchemaWithPreffiled & {
  id: string;
};

export type WebType = 'main' | 'backup';
export type FocusedWebbing = {
  type: WebType;
  index: number;
} | null;

type SectionContext = {
  fields: WebbingWithId[];
  append: (webbing: WebbingSchemaWithPreffiled) => void;
  update: (index: number, webbing: WebbingSchemaWithPreffiled) => void;
  remove: (index: number) => void;
  swap: (indexA: number, indexB: number) => void;
};
type RiggingFormContextType = {
  form: UseFormReturn<RigSchema>;
  main: SectionContext;
  backup: SectionContext;
  focusedWebbing: FocusedWebbing;
  highlineLength: number;
  handleNewSection: (type: WebType) => void;
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
};

const RiggingFormContext = React.createContext<RiggingFormContextType | null>(
  null,
);

export const RigFormProvider: React.FC<{
  highlineLength: number;
  children: React.ReactNode;
}> = ({ highlineLength, children }) => {
  const [focusedWebbing, setFocusedWebbing] =
    React.useState<FocusedWebbing | null>(null);

  const form = useForm<RigSchema>({
    resolver: zodResolver(rigSchema),
    mode: 'onChange',
    defaultValues: {
      webbing: {
        main: [
          // {
          //   length: highlineLength.toString(),
          //   leftLoop: true,
          //   rightLoop: true,
          //   tagName: getWebbingName(null),
          // },
        ],
        backup: [
          // {
          //   length: highlineLength.toString(),
          //   leftLoop: true,
          //   rightLoop: true,
          //   tagName: getWebbingName(null),
          // },
        ],
      },
      rigDate: new Date(),
    },
  });

  const main = useFieldArray({ control: form.control, name: 'webbing.main' });
  const backup = useFieldArray({
    control: form.control,
    name: 'webbing.backup',
  });

  const handleNewSection = React.useCallback((type: WebType) => {
    const webbing: WebbingSchemaWithPreffiled = {
      length: '50',
      leftLoop: false,
      rightLoop: false,
      tagName: getWebbingName(null),
    };

    if (type === 'main') {
      main.append(webbing);
    } else if (type === 'backup') {
      backup.append(webbing);
    }

    setFocusedWebbing({
      type,
      index: type === 'main' ? main.fields.length : backup.fields.length,
    });
  }, []);

  return (
    <RiggingFormContext.Provider
      value={{
        form,
        main: { ...main, fields: main.fields },
        backup: { ...backup, fields: backup.fields },
        focusedWebbing,
        highlineLength,
        handleNewSection,
        setFocusedWebbing,
      }}
    >
      {children}
    </RiggingFormContext.Provider>
  );
};

export function useRiggingForm() {
  const context = React.useContext(RiggingFormContext);
  if (!context) {
    throw new Error('useRiggingForm must be used within a RigFormProvider');
  }
  return context;
}
