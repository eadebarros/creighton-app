import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';
import type { FertilityColorToken } from '@creighton/rules-engine';
import { hashRotationDegrees } from './stampRotation';

export interface StampBadgeProps {
  color: FertilityColorToken;
  rawCode: string;
  intercourse?: boolean;
  /** e.g. "P", "P+1" — floats above the stamp when present. */
  peakLabel?: string;
  /** Seed for the deterministic tilt — usually the day's date. Falls back to rawCode. */
  daySeed?: string;
  size?: number;
}

const TOKEN_STYLES: Record<FertilityColorToken, { bg: string; ink: string; border?: string; borderTone: string }> = {
  RED: { bg: colors.red, ink: colors.white, borderTone: 'rgba(0,0,0,0.12)' },
  GREEN: { bg: colors.green, ink: colors.white, borderTone: 'rgba(0,0,0,0.12)' },
  WHITE: { bg: colors.white, ink: colors.ink, border: 'rgba(43,42,40,0.10)', borderTone: 'rgba(43,42,40,0.14)' },
  YELLOW: { bg: colors.yellow, ink: colors.ink, borderTone: 'rgba(0,0,0,0.12)' },
};

/** The product's signature stamp — a tilted, glued-paper-looking square per design/README.md. */
export function StampBadge({
  color,
  rawCode,
  intercourse = false,
  peakLabel,
  daySeed,
  size = 64,
}: StampBadgeProps) {
  const tokenStyle = TOKEN_STYLES[color];
  const rotation = useMemo(() => hashRotationDegrees(daySeed ?? rawCode ?? '1'), [daySeed, rawCode]);
  const iconSize = Math.max(14, size * 0.34);
  const codeFontSize = Math.max(9, size * 0.16);
  const markerFontSize = Math.max(9, size * 0.14);
  const markerOffset = Math.max(2, size * 0.05);
  const pad = Math.max(4, size * 0.08);

  return (
    <View style={{ alignItems: 'center', width: size }}>
      {!!peakLabel && <Text style={styles.peakLabel}>{peakLabel}</Text>}
      <View style={{ width: size, height: size, transform: [{ rotate: `${rotation.toFixed(2)}deg` }] }}>
        {/* Hard-edged offset "glued paper" shadow, glued to the same rotation as the face. */}
        <View
          style={[StyleSheet.absoluteFill, { top: 3, backgroundColor: tokenStyle.borderTone, borderRadius: 4 }]}
        />
        <View
          style={[
            styles.face,
            {
              width: size,
              height: size,
              backgroundColor: tokenStyle.bg,
              borderWidth: tokenStyle.border ? 1 : 0,
              borderColor: tokenStyle.border,
              padding: pad,
              justifyContent: color === 'WHITE' ? 'space-between' : 'flex-end',
            },
          ]}
        >
          {color === 'WHITE' && (
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" opacity={0.55}>
              <Circle cx={12} cy={7} r={4} stroke={colors.ink} strokeWidth={1.4} fill="none" />
              <Circle cx={12} cy={17} r={6.5} stroke={colors.ink} strokeWidth={1.4} fill="none" />
            </Svg>
          )}
          <Text
            style={{
              fontFamily: fonts.mono.semiBold,
              fontSize: codeFontSize,
              color: tokenStyle.ink,
              opacity: 0.85,
              letterSpacing: 0.02 * codeFontSize,
            }}
          >
            {rawCode}
          </Text>
          {intercourse && (
            <Text
              style={[
                styles.marker,
                {
                  top: markerOffset,
                  right: markerOffset,
                  fontSize: markerFontSize,
                  color: tokenStyle.ink,
                  lineHeight: markerFontSize,
                },
              ]}
            >
              I
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: 4,
    position: 'relative',
    shadowColor: 'rgba(43,42,40,0.10)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  peakLabel: {
    fontFamily: fonts.mono.semiBold,
    fontSize: 11,
    color: colors.inkMuted,
    letterSpacing: 0.33,
    marginBottom: 4,
  },
  marker: {
    position: 'absolute',
    fontFamily: fonts.mono.semiBold,
    opacity: 0.7,
  },
});
