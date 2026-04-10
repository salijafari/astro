import { Platform, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * CSS animated gradient test — web only.
 * Visit /gradient-test in the browser to see it.
 * Delete this file when done testing.
 */

function CSSGradientBackground() {
  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .akhtar-gradient {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            270deg,
            #0f0c29,
            #302b63,
            #24243e,
            #0d3b2e,
            #0f2a4a,
            #302b63,
            #0f0c29
          );
          background-size: 400% 400%;
          animation: gradientShift 14s ease infinite;
        }

        .akhtar-gradient-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(
            ellipse at 30% 40%,
            rgba(48, 43, 99, 0.25),
            transparent 60%
          ),
          radial-gradient(
            ellipse at 70% 70%,
            rgba(13, 59, 46, 0.2),
            transparent 60%
          );
          pointer-events: none;
        }
      `}</style>
      <div className="akhtar-gradient" />
      <div className="akhtar-gradient-overlay" />
    </>
  );
}

export default function GradientTestScreen() {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: "#0f0c29" }]}>
        <Text style={styles.text}>Web only test screen</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CSSGradientBackground />
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.label}>Akhtar Gradient Test</Text>
        <Text style={styles.sublabel}>
          CSS animated gradient{"\n"}
          Deep cosmic · Purple · Emerald · Cobalt
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0c29",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 22,
    fontWeight: "600",
  },
  sublabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  text: {
    color: "white",
    fontSize: 16,
  },
});
