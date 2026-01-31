import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TUNING } from '../tuning';
import { getUpgradeCost, useMeta } from '../meta/meta';

const getPalette = (paletteId: string) =>
  TUNING.cosmetics.palettes.find((palette) => palette.id === paletteId) ?? TUNING.cosmetics.palettes[0];

export const HangarScreen = () => {
  const insets = useSafeAreaInsets();
  const { meta, buyUpgrade, grantTickets, setPalette, setTrail } = useMeta();
  const palette = getPalette(meta.cosmetics.paletteId);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.bg[0], paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.neonA }]}>Hangar</Text>
        <Text style={styles.subtitle}>Tune your kit before the next 60-second run.</Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Credits</Text>
          <Text style={styles.statValue}>{meta.credits}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Tickets</Text>
          <Text style={styles.statValue}>{meta.tickets}</Text>
        </View>
        <Pressable style={[styles.statButton, { borderColor: palette.neonB }]} onPress={() => grantTickets(1)}>
          <Text style={[styles.statButtonText, { color: palette.neonB }]}>+1 Ticket</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Upgrades</Text>
      {Object.entries(TUNING.upgrades.list).map(([id, upgrade]) => {
        const level = meta.upgrades[id] ?? 0;
        const cost = getUpgradeCost(id as keyof typeof TUNING.upgrades.list, level);
        const disabled = level >= upgrade.maxLevel || meta.credits < cost;
        return (
          <View key={id} style={styles.card}>
            <View>
              <Text style={styles.cardTitle}>{id.replace('_', ' ')}</Text>
              <Text style={styles.cardSub}>Level {level} / {upgrade.maxLevel}</Text>
            </View>
            <Pressable
              style={[
                styles.buyButton,
                { backgroundColor: disabled ? 'rgba(255,255,255,0.08)' : palette.neonA },
              ]}
              onPress={() => buyUpgrade(id as keyof typeof TUNING.upgrades.list)}
              disabled={disabled}>
              <Text style={styles.buyText}>{level >= upgrade.maxLevel ? 'MAX' : `Buy • ${cost}`}</Text>
            </Pressable>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Palettes</Text>
      <View style={styles.optionRow}>
        {TUNING.cosmetics.palettes.map((option) => (
          <Pressable
            key={option.id}
            style={[
              styles.optionChip,
              meta.cosmetics.paletteId === option.id && { borderColor: palette.neonA, borderWidth: 2 },
            ]}
            onPress={() => setPalette(option.id)}>
            <View style={[styles.swatch, { backgroundColor: option.neonA }]} />
            <View style={[styles.swatch, { backgroundColor: option.neonB }]} />
            <View style={[styles.swatch, { backgroundColor: option.neonC }]} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Trails</Text>
      <View style={styles.optionRow}>
        {TUNING.cosmetics.trails.map((trail) => (
          <Pressable
            key={trail.id}
            style={[
              styles.trailChip,
              meta.cosmetics.trailId === trail.id && { borderColor: palette.neonC, borderWidth: 2 },
            ]}
            onPress={() => setTrail(trail.id)}>
            <Text style={styles.trailText}>{trail.id.replace('TRAIL_', '')}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#C6D0FF',
    marginTop: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0C0F1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 90,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#8D97C9',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statButtonText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: '#fff',
    marginBottom: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0C0F1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    color: '#fff',
  },
  cardSub: {
    fontSize: 11,
    color: '#8D97C9',
  },
  buyButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#05060B',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  optionChip: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 6,
  },
  trailChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  trailText: {
    fontSize: 12,
    color: '#C6D0FF',
  },
});
