import { Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { cn } from '~/lib/utils';
import { numberAsString } from '~/utils/zod';

import { Switch } from '~/components/ui/switch';

export const webbingSchema = z.object({
  model: z.string().optional(),
  length: numberAsString({
    acceptZero: false,
    positiveOnly: true,
    numberType: 'integer',
    required: true,
  }),
  leftLoop: z.boolean(),
  rightLoop: z.boolean(),
});

export type WebbingSchema = z.infer<typeof webbingSchema>;

const LoopSwitch = ({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <View className="items-center gap-1">
    <Switch
      disabled={disabled}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
    <Text>Olhal</Text>
  </View>
);

const LoopIndicator = ({ loop }: { loop: boolean }) => (
  <View
    className={cn(
      'h-4 w-10',
      loop ? 'bg-primary' : 'bg-muted border border-muted-foreground',
    )}
  />
);

export const WebbingInput: React.FC<{
  leftLoop: boolean;
  rightLoop: boolean;
  length: string;
  onLeftLoopChange: (checked: boolean) => void;
  onRightLoopChange: (checked: boolean) => void;
  onLengthChange: (text: string) => void;
  disabled?: boolean;
  error?: string | null;
}> = ({
  leftLoop,
  rightLoop,
  length,
  onLeftLoopChange,
  onRightLoopChange,
  onLengthChange,
  disabled,
  error,
}) => {
  return (
    <View className="w-full gap-4">
      <View className="flex-row items-center">
        <LoopIndicator loop={leftLoop} />
        <View className="flex-1 h-2 bg-red-400" />
        <LoopIndicator loop={rightLoop} />
      </View>

      <View className="flex-row gap-2 items-end">
        <LoopSwitch
          checked={leftLoop}
          onCheckedChange={onLeftLoopChange}
          disabled={disabled}
        />

        <View className="flex-1 items-center">
          <View className="flex-row items-center">
            <TextInput
              className={cn(
                'text-center',
                disabled ? 'text-muted-foreground' : 'text-primary',
              )}
              keyboardType="numeric"
              placeholder="0"
              value={length}
              onChangeText={(text) => {
                if (/^\d*$/.test(text)) {
                  onLengthChange(text);
                }
              }}
              contextMenuHidden={!!disabled}
              editable={!disabled}
            />
            <Text
              className={cn(
                'font-bold',
                disabled ? 'text-muted-foreground' : 'text-primary',
              )}
            >
              m
            </Text>
          </View>
          <View
            className={cn(
              'w-full border',
              error ? 'border-red-400' : 'border-muted',
            )}
          />
          <Text className={cn('pt-1', error ? 'text-red-400' : 'text-primary')}>
            Comprimento da fita
          </Text>
        </View>

        <LoopSwitch
          checked={rightLoop}
          onCheckedChange={onRightLoopChange}
          disabled={disabled}
        />
      </View>
    </View>
  );
};
