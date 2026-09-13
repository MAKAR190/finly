import { colors } from "@/lib/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

function TabIcon({
  name,
  color,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  color: string;
}) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Головна",
          tabBarIcon: ({ color }) => <TabIcon name="wallet-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sort"
        options={{
          title: "Розкласти",
          tabBarIcon: ({ color }) => <TabIcon name="move-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Правила",
          tabBarIcon: ({ color }) => <TabIcon name="options-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bank"
        options={{
          title: "Банк",
          tabBarIcon: ({ color }) => <TabIcon name="card-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ще",
          tabBarIcon: ({ color }) => <TabIcon name="ellipsis-horizontal-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
