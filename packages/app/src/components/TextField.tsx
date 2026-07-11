import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    color: colors.inkMuted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body.regular,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  inputError: {
    // Not colors.red — that token is reserved for clinical bleeding/menstruation
    // meaning (Seção 9.1), never repurposed for generic form validation.
    borderColor: colors.ink,
  },
  error: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.ink,
  },
});
