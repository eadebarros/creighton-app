import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

export function ConfirmationScreen({ navigation }: Props) {
  return (
    <View style={styles.screen}>
      <Svg width={52} height={52} viewBox="0 0 52 52">
        <Path
          d="M15 27 L22 34 L37 18"
          stroke={colors.green}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.title}>Registrado</Text>
      <Text style={styles.subtitle}>O dado de hoje foi salvo. O status é calculado automaticamente.</Text>
      <Pressable
        style={styles.button}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Chart' }] })}
      >
        <Text style={styles.buttonText}>Ver gráfico do ciclo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.sm,
    marginTop: spacing.lg,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
});
