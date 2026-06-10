import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { planRoute } from '@weatherchaser/core';
import type { OptimizerInput } from '@weatherchaser/core';
import './src/i18n';

/**
 * Phase 5 scaffold screen: proves the shared @weatherchaser/core package
 * runs on React Native by planning a tiny deterministic demo route.
 * The real app (map, entry flow, itinerary) replaces this in Phase 5 plans.
 */
function demoRoute() {
  const coords: Array<[number, number]> = [
    [47.685, 13.005],
    [47.905, 12.45],
    [48.155, 11.54],
  ];
  const km = coords.map(([alat, alng]) =>
    coords.map(([blat, blng]) => Math.hypot(alat - blat, alng - blng) * 100),
  );
  const input: OptimizerInput = {
    towns: coords.map(([lat, lng], i) => ({ id: `t${i}`, name: `Town ${i}`, lat, lng })),
    distanceMatrix: km,
    durationMatrix: km.map((row) => row.map((d) => (d / 70) * 3600)),
    weatherScores: [70, 85, 60].map((v) => ({
      composite: v,
      breakdown: { sunshine: v, precipitation: v, temperature: v, wind: v },
    })),
    config: {
      startIndex: 0,
      totalDays: 4,
      maxStay: 2,
      mustVisitIndices: [],
      startDate: new Date('2026-07-01T00:00:00Z'),
      weights: { sunshine: 0.25, precipitation: 0.25, temperature: 0.25, wind: 0.25 },
    },
  };
  return planRoute(input);
}

export default function App() {
  const { t } = useTranslation('common');
  const route = demoRoute();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.title')}</Text>
      <Text style={styles.tagline}>{t('app.tagline')}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('mobile_scaffold.core_check')}</Text>
        <Text style={styles.cardBody}>
          {t('mobile_scaffold.core_ok', {
            stops: route.stops.length,
            km: Math.round(route.totalDistanceKm),
          })}
        </Text>
      </View>
      <Text style={styles.note}>{t('mobile_scaffold.coming_soon')}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0d8f9f',
  },
  tagline: {
    fontSize: 14,
    color: '#3d6b70',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    shadowColor: '#0d8f9f',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d2426',
  },
  cardBody: {
    fontSize: 13,
    color: '#3d6b70',
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#6b9198',
  },
});
