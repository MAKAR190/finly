import { Button, Card, Field, Screen, Subtitle, Title } from "@/components/finly/Ui";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { parsePlnInput } from "@finly/shared";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { salaryRule, saveSalaryRule, apiUrl, saveApiUrl } = useStore();
  const [keywords, setKeywords] = useState(salaryRule.keywords.join(", "));
  const [minAmount, setMinAmount] = useState(
    salaryRule.minAmount ? String(salaryRule.minAmount / 100) : "",
  );
  const [maxAmount, setMaxAmount] = useState(
    salaryRule.maxAmount ? String(salaryRule.maxAmount / 100) : "",
  );
  const [autoConfirm, setAutoConfirm] = useState(salaryRule.autoConfirm);
  const [url, setUrl] = useState(apiUrl);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>Налаштування</Title>
        <Subtitle>Мова інтерфейсу — українська, валюта PLN.</Subtitle>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.heading}>Детект зарплати</Text>
            <Field
              label="Ключові слова"
              value={keywords}
              onChangeText={setKeywords}
              placeholder="wynagrodzenie, зарплата"
            />
            <Field
              label="Мін. сума, zł (необов’язково)"
              value={minAmount}
              onChangeText={setMinAmount}
              keyboardType="numeric"
            />
            <Field
              label="Макс. сума, zł (необов’язково)"
              value={maxAmount}
              onChangeText={setMaxAmount}
              keyboardType="numeric"
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Наповнювати кошики без підтвердження</Text>
              <Switch value={autoConfirm} onValueChange={setAutoConfirm} />
            </View>
            <Button
              label="Зберегти правило ЗП"
              onPress={() => {
                void saveSalaryRule({
                  keywords: keywords
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                  minAmount: minAmount ? parsePlnInput(minAmount) ?? undefined : undefined,
                  maxAmount: maxAmount ? parsePlnInput(maxAmount) ?? undefined : undefined,
                  autoConfirm,
                });
                Alert.alert("Збережено");
              }}
            />
          </Card>

          <Card>
            <Text style={styles.heading}>API</Text>
            <Field
              label="Адреса backend"
              value={url}
              onChangeText={setUrl}
              keyboardType="url"
              placeholder="http://10.0.2.2:3001"
            />
            <Button
              label="Зберегти URL"
              kind="ghost"
              onPress={() => {
                void saveApiUrl(url.trim());
                Alert.alert("Збережено");
              }}
            />
          </Card>
        </ScrollView>
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  switchLabel: {
    flex: 1,
    color: colors.ink,
  },
});
