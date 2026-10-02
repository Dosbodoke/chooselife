# Highline browsing prototype

Question: how should people browse 77 highlines without a single long horizontal strip?

Throwaway branch: codex/prototype-highline-layouts. No layout has been selected yet.

Run from repository root:

```sh
pnpm --filter chooselife-web prototype:highlines
```

Open http://localhost:3220/en?variant=A. The floating bottom bar switches variants, as do left/right arrow keys outside inputs. URLs keep the selected variant and page.

- A: image-first card grid with 12 results and explicit page controls.
- B: compact rows for scanning names, dimensions, and thumbnails.
- C: selectable list and a larger detail panel. On narrow screens the detail moves above the list.

The default dataset is a read-only snapshot of 18 public production highlines, captured on October 2, 2026. It is deliberately labeled as a sample. Switch the data dropdown to use the existing local getHighline Server Action instead. No favorite, create, or other write actions are wired into the prototype.

The route, prototype bar, and layout selection are gated to development. Keep these files out of main. Once a layout is selected, implement that decision separately and retain this branch as the design source.
