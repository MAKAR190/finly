import { Button, Card, Field, Screen, Subtitle, Title } from "@/components/finly/Ui";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { parsePlnInput, percentTotal } from "@finly/shared";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PALETTE = ["#E85D4C", "#5B8DEF", "#8B7CF6", "#F2A65A", "#E85D9A", "#3DCFB6", "#3D9B6C", "#2C6EAD"];

export default function RulesScreen() {
  const { baskets, categories, rules, applyManualSalary, addCategory, updateRule, toggleCategoryHidden } =
    useStore();
  const [salary, setSalary] = useState("10000");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [openAdd, setOpenAdd] = useState(false);

  const percentSum = percentTotal(rules);
  const visibleIds = new Set(baskets.map((basket) => basket.category.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>Правила</Title>
        <Subtitle>Фікс знімається першим, відсотки ділять залишок. Зараз відсотки: {percentSum}%</Subtitle>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Card style={{ marginBottom: 14 }}>
            <Field label="Ручна зарплата, zł" value={salary} onChangeText={setSalary} keyboardType="numeric" />
            <Button
              label="Зарахувати ЗП і наповнити кошики"
              onPress={() => {
                const amount = parsePlnInput(salary);
                if (amount == null || amount <= 0) {
                  Alert.alert("Перевір суму");
                  return;
                }
                void applyManualSalary(amount);
              }}
            />
          </Card>

          {categories.map((category) => {
            const rule = rules.find((item) => item.categoryId === category.id) ?? {
              categoryId: category.id,
              fixedAmount: 0,
              percent: 0,
            };
            return (
              <Card key={category.id} style={{ marginBottom: 10, opacity: category.hidden ? 0.45 : 1 }}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: category.color }]} />
                  <Text style={styles.name}>{category.name}</Text>
                  <Pressable onPress={() => void toggleCategoryHidden(category.id)}>
                    <Text style={styles.link}>{category.hidden ? "Показати" : "Сховати"}</Text>
                  </Pressable>
                </View>
                {visibleIds.has(category.id) || !category.hidden ? (
                  <View style={styles.inputs}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Фікс, zł"
                        value={rule.fixedAmount ? String(rule.fixedAmount / 100) : ""}
                        keyboardType="numeric"
                        placeholder="0"
                        onChangeText={(value) => {
                          const amount = value ? parsePlnInput(value) : 0;
                          if (amount == null) return;
                          void updateRule({ ...rule, fixedAmount: amount });
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Відсоток"
                        value={rule.percent ? String(rule.percent) : ""}
                        keyboardType="numeric"
                        placeholder="0"
                        onChangeText={(value) => {
                          const percent = value ? Number(value.replace(",", ".")) : 0;
                          if (!Number.isFinite(percent)) return;
                          void updateRule({ ...rule, percent });
                        }}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })}

          <Button label="Додати категорію" kind="ghost" onPress={() => setOpenAdd(true)} />
        </ScrollView>
      </Screen>

      <Modal visible={openAdd} transparent animationType="fade" onRequestClose={() => setOpenAdd(false)}>
        <Pressable style={styles.modalBg} onPress={() => setOpenAdd(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Нова категорія</Text>
            <Field label="Назва" value={newName} onChangeText={setNewName} placeholder="Наприклад, Здоров’я" />
            <View style={styles.palette}>
              {PALETTE.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setNewColor(color)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    newColor === color && styles.swatchOn,
                  ]}
                />
              ))}
            </View>
            <Button
              label="Зберегти"
              onPress={() => {
                if (!newName.trim()) return;
                void addCategory(newName.trim(), newColor);
                setNewName("");
                setOpenAdd(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    flex: 1,
    fontWeight: "700",
    color: colors.ink,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
  inputs: {
    flexDirection: "row",
    gap: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    color: colors.ink,
  },
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  swatchOn: {
    borderWidth: 3,
    borderColor: colors.ink,
  },
});
