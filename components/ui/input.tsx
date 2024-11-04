import * as React from "react";
import {
  TextInput,
  type TextInputProps,
  View,
  TouchableOpacity,
} from "react-native";

import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";
import { LucideIcon } from "~/lib/icons/lucide-icon";

interface InputProps extends TextInputProps {
  label?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  (
    {
      label,
      id,
      className,
      placeholderClassName,
      rightIcon,
      onRightIconPress,
      ...props
    },
    ref
  ) => {
    return (
      <View className="gap-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        <View className="relative flex-row items-center">
          <TextInput
            ref={ref}
            id={id}
            className={cn(
              "flex-1 web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground placeholder:text-muted-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2",
              props.editable === false && "opacity-50 web:cursor-not-allowed",
              rightIcon && "pr-9", // Add padding to accommodate the icon
              className
            )}
            placeholderClassName={cn(
              "text-muted-foreground",
              placeholderClassName
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
      </View>
    );
  }
);

Input.displayName = "Input";

interface PasswordInputProps {
  id: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
}

const PasswordInput = ({
  label,
  id,
  placeholder = "Password",
  value,
  onChangeText,
  editable = true,
}: PasswordInputProps) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  return (
    <Input
      label={label}
      id={id}
      className="pe-9"
      placeholder={placeholder}
      secureTextEntry={!isVisible} // For React Native; use 'type' for web
      rightIcon={
        isVisible ? (
          <LucideIcon
            name="EyeOff"
            size={16}
            strokeWidth={2}
            className="color-foreground"
          />
        ) : (
          <LucideIcon
            name="Eye"
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
    />
  );
};

export { Input, PasswordInput };
