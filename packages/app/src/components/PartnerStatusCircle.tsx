import { StyleSheet, View } from 'react-native';
import type { FertilityColorToken } from '@creighton/rules-engine';
import { colors } from '../theme';

const TOKEN_COLOR: Record<FertilityColorToken, string> = {
  RED: colors.red,
  GREEN: colors.green,
  WHITE: colors.white,
  YELLOW: colors.yellow,
};

interface Props {
  color: FertilityColorToken | null;
  size?: number;
}

/**
 * Deliberately plain — no raw code, no text inside, no intercourse marker
 * (unlike <StampBadge>). Briefing Seção 9.3: discreet enough not to embarrass
 * if seen by a third party, no literal "FÉRTIL — RISCO DE GRAVIDEZ" on screen.
 */
export function PartnerStatusCircle({ color, size = 160 }: Props) {
  const backgroundColor = color ? TOKEN_COLOR[color] : colors.line;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        color === 'WHITE' && styles.whiteBorder,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    alignSelf: 'center',
  },
  whiteBorder: {
    borderWidth: 1.5,
    borderColor: colors.line,
  },
});
