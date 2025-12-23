import { EyeIcon, EyeOffIcon } from 'lucide-react-native';
import React from 'react';
import {
  Platform,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps as PrimitiveTextInputProps,
} from 'react-native';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

export interface TextInputProps extends PrimitiveTextInputProps {
  label?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

function Input({
  className,
  rightIcon,
  onRightIconPress,
  ...props
}: TextInputProps & React.RefAttributes<TextInput>) {
  return (
    <View>
      <TextInput
        className={cn(
          'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
          props.editable === false &&
            cn(
              'opacity-50',
              Platform.select({
                web: 'disabled:pointer-events-none disabled:cursor-not-allowed',
              }),
            ),
          Platform.select({
            web: cn(
              'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            ),
            native: 'placeholder:text-muted-foreground/50',
          }),
          className,
        )}
        {...props}
      />
      {rightIcon && (
        <TouchableOpacity
          onPress={onRightIconPress}
          className="absolute inset-y-0 right-0 justify-center items-center pr-3"
          accessibilityLabel="Input Right Icon Button"
        >
          {rightIcon}
        </TouchableOpacity>
      )}
    </View>
  );
}

interface PasswordInputProps {
  id: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
}

function PasswordInput({
  id,
  placeholder = 'Password',
  value,
  onChangeText,
  editable = true,
  ...props
}: PasswordInputProps & React.RefAttributes<TextInput>) {
  const [isVisible, setIsVisible] = React.useState(false);

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  return (
    <Input
      id={id}
      className="pe-9"
      placeholder={placeholder}
      secureTextEntry={!isVisible} // For React Native; use 'type' for web
      rightIcon={
        isVisible ? (
          <Icon
            as={EyeOffIcon}
            size={16}
            strokeWidth={2}
            className="color-foreground"
          />
        ) : (
          <Icon
            as={EyeIcon}
            size={16}
            strokeWidth={2}
            className="color-foreground"
          />
        )
      }
      onRightIconPress={toggleVisibility}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      {...props}
    />
  );
}

export { Input, PasswordInput };
