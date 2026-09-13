import { Button, Card, Money, Screen, Subtitle, Title } from "@/components/finly/Ui";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { formatPln, type MoneyTransaction } from "@finly/shared";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const spring = { reduceMotion: ReduceMotion.Never };

type Rect = { id: string; x: number; y: number; w: number; h: number };

function inRect(x: number, y: number, rect: Rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function DraggableRow({
  tx,
  onDrop,
  onTap,
}: {
  tx: MoneyTransaction;
  onDrop: (txId: string, absX: number, absY: number) => void;
  onTap: (tx: MoneyTransaction) => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(160)
    .onStart(() => {
      scale.value = withSpring(1.04, spring);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(onDrop)(tx.id, event.absoluteX, event.absoluteY);
      x.value = withSpring(0, spring);
      y.value = withSpring(0, spring);
      scale.value = withSpring(1, spring);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    zIndex: scale.value > 1 ? 20 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>
        <Pressable onPress={() => onTap(tx)} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {tx.description}
            </Text>
            <Text style={styles.rowDate}>{tx.bookedAt}</Text>
          </View>
          <Money value={tx.amount} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export default function SortScreen() {
  const { inbox, baskets, assignToBasket, ignoreTx, returnToInbox, transactions } = useStore();
  const rects = useRef<Record<string, Rect>>({});
  const ignoreRect = useRef<Rect | null>(null);
  const nodeRefs = useRef<Record<string, View | null>>({});
  const [picked, setPicked] = useState<MoneyTransaction | null>(null);
  const [hint, setHint] = useState("Перетягни списання в кошик або натисни, щоб вибрати");

  const recentAssigned = transactions
    .filter((tx) => tx.status === "assigned")
    .slice(0, 5);

  const rememberRect = (id: string, node: View | null) => {
    node?.measureInWindow((x, y, w, h) => {
      rects.current[id] = { id, x, y, w, h };
    });
  };

  const handleDrop = (txId: string, absX: number, absY: number) => {
    if (ignoreRect.current && inRect(absX, absY, ignoreRect.current)) {
      void ignoreTx(txId);
      setHint("Ігноровано");
      return;
    }
    const hit = Object.values(rects.current).find((rect) => inRect(absX, absY, rect));
    if (hit) {
      void assignToBasket(txId, hit.id);
      const name = baskets.find((basket) => basket.category.id === hit.id)?.category.name;
      setHint(`Списано з «${name}»`);
      return;
    }
    setHint("Не влучив у кошик — спробуй ще або натисни на рядок");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>Розкласти</Title>
        <Subtitle>{hint}</Subtitle>
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {inbox.length === 0 ? (
            <Card>
              <Text style={styles.empty}>Список порожній. Нові списання з картки з’являться тут.</Text>
            </Card>
          ) : (
            inbox.map((tx) => (
              <DraggableRow key={tx.id} tx={tx} onDrop={handleDrop} onTap={setPicked} />
            ))
          )}

          <View
            ref={(node) => {
              nodeRefs.current.ignore = node;
            }}
            onLayout={() => {
              nodeRefs.current.ignore?.measureInWindow((x, y, w, h) => {
                ignoreRect.current = { id: "ignore", x, y, w, h };
              });
            }}
            style={styles.ignore}
          >
            <Text style={styles.ignoreText}>Ігнорувати · кинь сюди комісію чи свій переказ</Text>
          </View>

          <Text style={styles.section}>Кошики</Text>
          <View style={styles.grid}>
            {baskets.map((basket) => (
              <View
                key={basket.category.id}
                ref={(node) => {
                  nodeRefs.current[basket.category.id] = node;
                }}
                onLayout={() => rememberRect(basket.category.id, nodeRefs.current[basket.category.id])}
                style={[
                  styles.basket,
                  basket.remaining < 0 && { borderColor: colors.danger },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: basket.category.color }]} />
                <Text style={styles.basketName}>{basket.category.name}</Text>
                <Text
                  style={[
                    styles.basketRemain,
                    basket.remaining < 0 && { color: colors.danger },
                  ]}
                >
                  {formatPln(basket.remaining)}
                </Text>
              </View>
            ))}
          </View>

          {recentAssigned.length > 0 ? (
            <>
              <Text style={styles.section}>Недавно розкладені</Text>
              {recentAssigned.map((tx) => (
                <Card key={tx.id} style={{ marginBottom: 8 }}>
                  <Text style={styles.rowTitle}>{tx.description}</Text>
                  <Text style={styles.rowDate}>
                    {baskets.find((basket) => basket.category.id === tx.categoryId)?.category.name} ·{" "}
                    {formatPln(tx.amount)}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <Button label="Повернути в список" kind="ghost" onPress={() => void returnToInbox(tx.id)} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </ScrollView>
      </Screen>

      <Modal visible={Boolean(picked)} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPicked(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{picked?.description}</Text>
            <Text style={styles.rowDate}>{picked ? formatPln(picked.amount) : ""}</Text>
            <View style={styles.grid}>
              {baskets.map((basket) => (
                <Pressable
                  key={basket.category.id}
                  style={styles.basket}
                  onPress={() => {
                    if (!picked) return;
                    void assignToBasket(picked.id, basket.category.id);
                    setPicked(null);
                    setHint(`Списано з «${basket.category.name}»`);
                  }}
                >
                  <Text style={styles.basketName}>{basket.category.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: 10 }} />
            <Button
              label="Ігнорувати"
              kind="danger"
              onPress={() => {
                if (!picked) return;
                void ignoreTx(picked.id);
                setPicked(null);
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
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  rowTitle: {
    color: colors.ink,
    fontWeight: "600",
  },
  rowDate: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
  },
  empty: {
    color: colors.muted,
  },
  ignore: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.muted,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  ignoreText: {
    color: colors.muted,
    textAlign: "center",
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "700",
    color: colors.ink,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  basket: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  basketName: {
    color: colors.ink,
    fontWeight: "600",
  },
  basketRemain: {
    marginTop: 4,
    color: colors.muted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg,
    padding: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
});
