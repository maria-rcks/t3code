import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../../../components/AppText";
import { cn } from "../../../../lib/cn";
import { resolveNativeReviewDiffView } from "../../../diffs/nativeReviewDiffSurface";
import { buildNativeReviewDiffData } from "../../../review/nativeReviewDiffAdapter";
import { buildReviewParsedDiff } from "../../../review/reviewModel";
import { useNativeReviewDiffBridge } from "../../../review/useNativeReviewDiffBridge";
import { SettingsSection } from "../../components/SettingsSection";
import { useAppearancePreferences } from "../AppearancePreferencesProvider";
import { useAppearanceCodeSurface } from "../useAppearanceCodeSurface";
import { AppearancePreviewSeparator } from "../components/AppearancePreviews";

const PREVIEW_DIFF = `diff --git a/greeting.ts b/greeting.ts
--- a/greeting.ts
+++ b/greeting.ts
@@ -1,3 +1,3 @@
 function greet(name) {
-  return "Hi, " + name;
+  return "Hello, " + name;
 }
`;
const PREVIEW_DATA = buildNativeReviewDiffData(buildReviewParsedDiff(PREVIEW_DIFF, "appearance"));
const EMPTY_IDS: ReadonlyArray<string> = [];
const OPTIONS = [
  { value: "red-green", label: "Red & green" },
  { value: "blue-orange", label: "Blue & orange" },
] as const;

export function DiffAppearanceSection() {
  const { diffColorScheme, setDiffColorScheme, themeAppearance, isReady } =
    useAppearancePreferences();
  const { codeSurface, nativeReviewDiffStyle } = useAppearanceCodeSurface();
  const [width, setWidth] = useState(320);
  const [NativeReviewDiffView] = useState(resolveNativeReviewDiffView);
  const bridge = useNativeReviewDiffBridge({
    threadKey: null,
    sectionId: "appearance",
    diff: PREVIEW_DIFF,
    data: PREVIEW_DATA,
    collapsedFileIds: EMPTY_IDS,
    viewedFileIds: EMPTY_IDS,
    selectedRowIds: EMPTY_IDS,
    canHighlight: true,
  });

  return (
    <SettingsSection card title="Diff colors">
      {NativeReviewDiffView ? (
        <View
          pointerEvents="none"
          style={{ height: nativeReviewDiffStyle.fileHeaderHeight + codeSurface.rowHeight * 5 }}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          <NativeReviewDiffView
            style={{ flex: 1 }}
            appearanceScheme={themeAppearance}
            contentWidth={width}
            rowHeight={codeSurface.rowHeight}
            rowsJson={bridge.rowsJson}
            themeJson={bridge.themeJson}
            styleJson={bridge.styleJson}
            tokensPatchJson={bridge.tokensPatchJson}
            tokensResetKey={bridge.tokensResetKey}
            onDebug={bridge.onDebug}
          />
        </View>
      ) : null}
      <AppearancePreviewSeparator />
      <View className="flex-row gap-2 p-3">
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: diffColorScheme === option.value, disabled: !isReady }}
            disabled={!isReady}
            className={cn(
              "min-h-11 flex-1 items-center justify-center rounded-xl px-2",
              diffColorScheme === option.value ? "bg-subtle-strong" : "active:bg-subtle",
            )}
            onPress={() => setDiffColorScheme(option.value)}
          >
            <Text className="text-sm font-t3-medium text-foreground">{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </SettingsSection>
  );
}
