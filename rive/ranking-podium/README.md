# Ranking podium

Rive CLI source for the podium used by `expo/components/ranking/index.tsx` through its shared leaderboard.

The Gold, Silver, and Bronze artboards contain the podium steps. Each `Podium` state machine plays a single `Reveal` timeline and holds its final pose. Bronze starts immediately, Silver after 5 frames, and Gold after 10 frames. Each reveal lasts 17 frames at 60 fps and animates translation and opacity with a cubic ease-out.

Profiles, usernames, scores, and position labels remain React Native elements. Their entrance follows the same timing. The source of podium colors and dimensions in the app is `podium-step.shared.tsx`; keep it aligned with these artboards when editing the scene.

From the repository root:

```sh
rive rive/ranking-podium --verify
rive inspect rive/ranking-podium --json
rive rive/ranking-podium --once
cp rive/ranking-podium/build/ranking-podium.riv expo/assets/animations/ranking-podium.riv
```

For a visual check:

```sh
rive rive/ranking-podium --artboard=Gold --screenshot=/tmp/podium-gold.png --advance=1s
```

The app uses `@rive-app/react-native` on iOS and Android. Adding the native runtime requires a new development build. Reduced motion and missing podium entries use a static SVG of the final pose. Load or playback failures also fall back to the static SVG. Pagination does not remount the podium or replay its entrance.

Verified on the iPhone 17 simulator running iOS 26.5 with a native development build: all three Rive artboards mounted, winner profile navigation worked, empty entries had no profile links, and the reduced-motion branch rendered the static final pose. The temporary test route was removed after verification.
