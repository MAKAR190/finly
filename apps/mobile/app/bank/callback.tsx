import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function BankCallbackScreen() {
  const { syncBank } = useStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncBank();
      } catch {
        // Bank tab still has a manual sync button
      } finally {
        if (!cancelled) router.replace("/bank");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once when the bank redirects back into the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24 }}>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>Повертаю з банку…</Text>
    </View>
  );
}
