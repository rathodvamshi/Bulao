import React, { forwardRef, useState } from "react";
import { Pressable, type PressableProps, type View } from "react-native";

/** Resolve callback styles before style interop to preserve layout and feedback. */
export const AppPressable = forwardRef<View, PressableProps>(
  function AppPressable(
    { style, onPressIn, onPressOut, onBlur, disabled, ...props },
    ref,
  ) {
    const [pressed, setPressed] = useState(false);
    return (
      <Pressable
        {...props}
        ref={ref}
        disabled={disabled}
        style={
          typeof style === "function"
            ? style({ pressed: pressed && !disabled })
            : style
        }
        onPressIn={(event) => {
          setPressed(true);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          onPressOut?.(event);
        }}
        onBlur={(event) => {
          setPressed(false);
          onBlur?.(event);
        }}
      />
    );
  },
);
