import { Button, Card, Money, Screen, Subtitle, Title } from "@/components/finly/Ui";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BankScreen() {
  const {
    connection,
    pendingSalaries,
    connectBank,
    syncBank,
    disconnectBank,
    confirmPendingSalary,
    rejectPendingSalary,
    apiUrl,
  } = useStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      if (event.url.includes("bank/callback")) {
        void WebBrowser.dismissBrowser();
        void onSync();
      }
    });
    return () => sub.remove();
  }, []);

  const startConnect = async (institution: "sandbox" | "pko") => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await connectBank(institution);
      if (next.link) {
        const redirect = Linking.createURL("bank/callback");
        const result = await WebBrowser.openAuthSessionAsync(next.link, redirect);
        if (result.type === "success") {
          await onSync();
          return;
        }
      }
      setMessage("Після згоди в банку натисни «Синхронізувати».");
    } catch (error) {
      Alert.alert("Банк", error instanceof Error ? error.message : "Не вдалося підключити");
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const result = await syncBank();
      setMessage(`Нових списань у inbox: ${result.added}. Очікують ЗП: ${result.pendingSalary}.`);
    } catch (error) {
      Alert.alert("Синк", error instanceof Error ? error.message : "Не вдалося синхронізувати");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>Банк</Title>
        <Subtitle>GoCardless AIS. Секрети лишаються на API ({apiUrl}).</Subtitle>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.label}>Статус</Text>
            <Text style={styles.value}>
              {connection
                ? `${connection.institutionId} · ${connection.status}`
                : "Не підключено"}
            </Text>
            {connection?.expiresAt ? (
              <Text style={styles.meta}>Згода до {connection.expiresAt.slice(0, 10)} (~90 днів)</Text>
            ) : null}
          </Card>

          <View style={{ gap: 8, marginBottom: 16 }}>
            <Button
              label={busy ? "Працюю…" : "Підключити sandbox"}
              onPress={() => void startConnect("sandbox")}
              disabled={busy}
            />
            <Button
              label="Підключити PKO Bank Polski"
              kind="ghost"
              onPress={() => void startConnect("pko")}
              disabled={busy}
            />
            <Button label="Синхронізувати" kind="ghost" onPress={() => void onSync()} disabled={busy} />
            {connection ? (
              <Button label="Від’єднати" kind="danger" onPress={() => void disconnectBank()} />
            ) : null}
          </View>

          {message ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.value}>{message}</Text>
            </Card>
          ) : null}

          {pendingSalaries.map((item) => (
            <Card key={item.id} style={{ marginBottom: 10 }}>
              <Text style={styles.label}>Це зарплата?</Text>
              <Text style={styles.value}>{item.description}</Text>
              <Money value={item.amount} />
              <Text style={styles.meta}>{item.bookedAt}</Text>
              <View style={{ height: 8 }} />
              <Button label="Так, наповнити кошики" onPress={() => void confirmPendingSalary(item.id)} />
              <View style={{ height: 8 }} />
              <Button label="Ні" kind="ghost" onPress={() => void rejectPendingSalary(item.id)} />
            </Card>
          ))}
        </ScrollView>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.muted,
    marginBottom: 4,
  },
  value: {
    color: colors.ink,
    fontWeight: "600",
  },
  meta: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 12,
  },
});
