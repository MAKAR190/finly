import { Button, Card, Money, Screen, Subtitle, Title } from "@/components/finly/Ui";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { formatPln } from "@finly/shared";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { ready, period, baskets, inboxCount, pendingSalaries } = useStore();

  if (!ready) {
    return (
      <Screen>
        <Title>finly</Title>
        <Subtitle>Завантажую конверти…</Subtitle>
      </Screen>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>Конверти</Title>
        <Subtitle>
          {period
            ? `Цикл від ${period.startedAt} · ЗП ${formatPln(period.paycheckAmount)}`
            : "Ще немає зарплати в цьому циклі"}
        </Subtitle>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {inboxCount > 0 ? (
            <Pressable onPress={() => router.push("/sort")} style={styles.banner}>
              <Text style={styles.bannerText}>
                Розкласти {inboxCount} {inboxCount === 1 ? "списання" : "списань"}
              </Text>
            </Pressable>
          ) : null}

          {pendingSalaries.length > 0 ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.pendingTitle}>Схоже на зарплату</Text>
              <Text style={styles.pendingHint}>Підтвердь у вкладці «Банк», щоб наповнити кошики.</Text>
            </Card>
          ) : null}

          <View style={styles.grid}>
            {baskets.map((basket) => {
              const ratio =
                basket.limitAmount > 0 ? Math.min(1, basket.spent / basket.limitAmount) : 0;
              return (
                <View key={basket.category.id} style={styles.tile}>
                  <View style={[styles.dot, { backgroundColor: basket.category.color }]} />
                  <Text style={styles.tileName}>{basket.category.name}</Text>
                  <Money value={basket.remaining} danger={basket.remaining < 0} />
                  <Text style={styles.limit}>з {formatPln(basket.limitAmount)}</Text>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round(ratio * 100)}%`,
                          backgroundColor: basket.remaining < 0 ? colors.danger : basket.category.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 12 }} />
          <Button label="Розкласти списання" onPress={() => router.push("/sort")} />
        </ScrollView>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#F3D2BE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  bannerText: {
    color: colors.ink,
    fontWeight: "700",
  },
  pendingTitle: {
    fontWeight: "700",
    color: colors.ink,
  },
  pendingHint: {
    color: colors.muted,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexGrow: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  tileName: {
    color: colors.muted,
    marginBottom: 4,
  },
  limit: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  bar: {
    height: 6,
    backgroundColor: colors.line,
    borderRadius: 99,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
  },
});
