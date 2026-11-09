import React, { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useAppTypography } from "./AppText";

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    return <TextInput {...props} ref={ref} style={useAppTypography(style)} />;
  },
);
export default AppTextInput;
