export const HOME_PAGE_CSS = `
:root {
  --p-bg: #0f0f0f; --p-surface: #1a1a1a; --p-ink: #ffffff; --p-muted: #8f8f8f;
  --p-accent: #dafa9c; --p-accent-ink: #0f0f0f; --p-action: #dafa9c; --p-action-ink: #0f0f0f;
  --p-inv-bg: #ffffff; --p-inv-surface: #ececec; --p-inv-ink: #0f0f0f; --p-inv-muted: #5f5f5f;
  --p-inv-accent: #0f0f0f; --p-inv-accent-ink: #ffffff; --p-inv-action: #0f0f0f; --p-inv-action-ink: #ffffff;
  --font-display: "Epilogue", system-ui, sans-serif;
  --font-text: "Epilogue", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --display-weight: 400;
  --display-tracking: -0.035em;
  --display-tracking-xl: -0.052em;
  --ly-scale: 0.82;
  --t-h2: clamp(28px, 1.15vw + 22.5px, 39px);
  --g-noise-soft: linear-gradient(transparent, transparent);
}

/* Preserve layout-v4 one-screen geometry on sections styled by backgrounds.css */
main > section.section:is(.bg-band, .bg-dots):not(.section--hero, .section--flush-top, .section--rule) {
  display: block;
  align-content: normal;
  padding: var(--padt) 0 calc(var(--padb) + var(--bar));
  height: calc(var(--h, 1) * 100svh);
  min-height: 0;
}
@media (min-width: 640px) and (max-width: 1279px) {
  main > section.section:is(.bg-band, .bg-dots):not(.section--hero, .section--flush-top, .section--rule) {
    display: flex;
    flex-direction: column;
    align-content: normal;
    height: auto;
    min-height: calc(var(--h, 1) * 100svh);
  }
  #workbench .app.ui {
    min-height: 460px;
  }
}
@media (max-width: 639px) {
  main > section.section:is(.bg-band, .bg-dots):not(.section--hero, .section--flush-top, .section--rule) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr;
    align-content: normal;
    height: auto;
    min-height: calc(var(--hm, var(--h, 1)) * 100lvh);
  }
}

/* Keep primary Check BOM button identical across nav, hero, and footer */
.hero--triptych .hero__cta .btn {
  height: var(--btn-h);
  padding-inline: var(--s-5);
  font-size: var(--t-body);
}
@media (min-width: 1024px) and (max-width: 1279px) {
  .hero--triptych .hero__cta .btn {
    height: var(--btn-h);
    font-size: var(--t-body);
  }
}
@media (max-width: 1023px) {
  .hero--triptych .hero__cta .btn {
    height: var(--btn-h);
    font-size: var(--t-body);
  }
}

/* Nav cards & narrow 320px fit */
.menu-card .panel { --p-h: 176px; }
.menu-card__copy { display: grid; gap: 4px; }
.menu-card__desc { font-size: 14px; line-height: 1.4; color: var(--muted); }
@media (max-width: 374px) {
  .nav__bar { gap: 6px; }
  .nav__logo { font-size: 15px; gap: 5px; }
  .nav__logo .mark--initial { width: 18px; height: 18px; font-size: 11px; }
  .nav:not(.is-open) .nav__actions .btn { padding-inline: 10px; font-size: 13px; gap: 4px; }
}

/* Mini static UI previews inside nav-cards dropdown */
.nav-mini {
  width: 340px;
  padding: 12px 14px;
  border-radius: 6px;
  background: #171717;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.14);
  font: 400 12px/1.45 var(--font-mono);
  display: grid;
  gap: 8px;
}
.nav-mini__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #a3a3a3;
  font-size: 11px;
}
.nav-mini__head b { color: #dafa9c; font-weight: 500; }
.nav-mini__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nav-mini__tag {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}
.nav-mini__tag--err { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
.nav-mini__tag--warn { background: rgba(217, 119, 6, 0.22); color: #fcd34d; }
.nav-mini__tag--ok { background: rgba(218, 250, 156, 0.18); color: #dafa9c; }

/* Screen 1: Hero triptych collage pieces (higher specificity than layout.css .ly-collage .ly-piece) */
.ly-collage { container-type: inline-size; }
.ly-collage .ly-piece {
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25), 0 22px 48px -22px rgb(0 0 0 / 0.55);
}
.ly-collage .ly-piece.pc-card {
  background: #f6f6f2;
  color: #0f0f0f;
  padding: 3.2cqw 3.6cqw;
  display: grid;
  align-content: start;
  gap: 1.4cqw;
  font: 400 max(13px, 1.95cqw)/1.28 var(--font-text);
  border: 1px solid rgba(15, 15, 15, 0.12);
}
.ly-collage .ly-piece.pc-card--dark {
  background: #171717;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.ly-collage .ly-piece.pc-card--sage {
  background: #dce3d6;
  color: #161b14;
  border: 1px solid rgba(22, 27, 20, 0.16);
}
.ly-collage .ly-piece.pc-card--lime {
  background: #dafa9c;
  color: #0f0f0f;
  border: 1px solid rgba(15, 15, 15, 0.16);
}
.ly-collage .ly-piece.pc-schem {
  background: #161616;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 2.6cqw 10cqw 2.6cqw 3.4cqw;
  display: grid;
  align-content: center;
  gap: 1.2cqw;
}
.pc-kicker {
  font: 500 max(13px, 1.8cqw)/1.18 var(--font-mono);
  color: #464642;
  letter-spacing: -0.01em;
}
.ly-collage .ly-piece.pc-card--dark .pc-kicker,
.ly-collage .ly-piece.pc-schem .pc-kicker { color: #c4c4be; }
.ly-collage .ly-piece.pc-card--lime .pc-kicker { color: #242e16; }
.pc-title {
  font: 500 max(13px, 2.35cqw)/1.18 var(--font-display);
  letter-spacing: -0.02em;
}
.pc-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.pc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.4cqw;
  padding-top: 1.2cqw;
  border-top: 1px solid rgba(15, 15, 15, 0.12);
  font-size: max(13px, 1.8cqw);
}
.ly-collage .ly-piece.pc-card--dark .pc-row { border-top-color: rgba(255, 255, 255, 0.14); }
.pc-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3cqw 1cqw;
  border-radius: 3px;
  font: 600 max(13px, 1.65cqw)/1.18 var(--font-mono);
  white-space: nowrap;
}
.pc-badge--bad { background: #fee2e2; color: #991b1b; }
.pc-badge--warn { background: #fef3c7; color: #92400e; }
.pc-badge--ok { background: #e3f5c0; color: #1f3309; }
.ly-collage .ly-piece.pc-card--dark .pc-badge--bad { background: rgba(220, 38, 38, 0.24); color: #fecaca; }
.ly-collage .ly-piece.pc-card--dark .pc-badge--ok { background: rgba(218, 250, 156, 0.2); color: #dafa9c; }
.pc-anchor {
  padding-right: 11cqw;
  padding-bottom: 9cqw;
}
.pc-schem svg {
  width: 100%;
  height: auto;
  max-height: 30cqw;
}
.pc-bar {
  height: 1.1cqw;
  min-height: 6px;
  width: 100%;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}
.pc-bar > i {
  display: block;
  height: 100%;
  background: #dafa9c;
}
.pc-bar--warn > i { background: #f59e0b; }

@media (max-width: 639px) {
  .pc-hide-sm { display: none !important; }
  .ly-collage .ly-piece.pc-card {
    padding: 8px 10px;
    gap: 4px;
    font-size: 13px;
    line-height: 1.2;
  }
  .ly-collage .ly-piece.pc-anchor {
    padding: 8px 10px;
  }
  .ly-collage .ly-piece.pc-schem {
    padding: 8px 10px;
    gap: 4px;
  }
  .pc-kicker { font-size: 13px; line-height: 1.15; }
  .pc-title { font-size: 13px; line-height: 1.2; }
  .pc-row { padding-top: 4px; font-size: 13px; gap: 6px; }
  .pc-badge { padding: 1px 5px; font-size: 13px; }
  .pc-schem svg { max-height: 98px; }
}

/* Screen 2: App-frame workbench (#workbench on bg-band) */
#workbench .app.ui {
  --fx-bg: #ffffff;
  --fx-surface: #f4f5f2;
  --fx-ink: #0f0f0f;
  --fx-muted: #424740;
  --u-muted: #424740;
  --u-soft: #4a5048;
  --fx-accent: #2c4a26;
  --fx-accent-ink: #ffffff;
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  margin-top: var(--s-6);
  background: var(--u-bg);
  border: 1px solid var(--u-border);
  border-radius: var(--u-r);
  box-shadow: var(--u-shadow);
  min-height: 0;
}
#workbench .app > .app__pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
#workbench .app > .app__pane + .app__pane {
  border-left: 1px solid var(--u-line);
}
#workbench .app > .app__pane > .ui-panel {
  width: 100%;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
#workbench .ui-win__search:focus-within {
  outline: 2px solid #0f0f0f;
  outline-offset: 2px;
}
#workbench .ui-win__input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--u-ink);
  font: 400 13px/16px var(--ui-font);
}
#workbench .ui-win__input:focus-visible {
  outline: 2px solid #0f0f0f;
  outline-offset: 1px;
  border-radius: 2px;
}
#workbench .ui-win__input::placeholder { color: #4a5048; }
#workbench .ui-win__nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 16px;
  color: var(--u-muted);
  cursor: pointer;
  text-align: left;
}
#workbench .ui-win__nav-btn:hover { background: var(--u-fill); color: var(--u-ink); }
#workbench .ui-win__nav-btn.is-on { background: var(--u-fill-2); color: var(--u-ink); font-weight: 500; }
#workbench .ui-win__nav-btn em { margin-left: auto; font-style: normal; font-size: 12px; color: var(--u-muted); }
#workbench .ui-win__item {
  list-style: none;
  margin: 0;
  padding: 0;
}
#workbench .ui-win__item + .ui-win__item .ui-win__row {
  box-shadow: inset 0 1px 0 var(--u-line);
}
#workbench .ui-win__row-btn {
  width: 100%;
  cursor: pointer;
  text-align: left;
  border: 0;
  background: transparent;
}
#workbench .ui-win__row-btn:hover { background: color-mix(in oklab, var(--u-ink) 3%, var(--u-bg)); }
#workbench .ui-win__row.is-sel {
  background: color-mix(in oklab, var(--u-accent) 10%, var(--u-bg));
  box-shadow: inset 2px 0 0 var(--u-accent);
}
@container ui-win (max-width: 419px) {
  #workbench .ui-win__input { display: none; }
}
#workbench .ui-win__who { font-family: var(--ui-mono); font-size: 12.5px; }
#workbench .ui-win__st--l3 {
  color: #991b1b;
  background: #fee2e2;
  box-shadow: inset 0 0 0 1px rgba(153, 27, 27, 0.22);
}
#workbench .ui-win__st--l2 {
  color: #92400e;
  background: #fef3c7;
  box-shadow: inset 0 0 0 1px rgba(146, 64, 14, 0.22);
}
#workbench .ui-win__st--l1 {
  color: #166534;
  background: #dcfce7;
  box-shadow: inset 0 0 0 1px rgba(22, 101, 52, 0.22);
}
#workbench .ui-diff__by {
  height: auto;
  min-height: 24px;
  flex-wrap: wrap;
  row-gap: 6px;
}
#workbench .ui-diff__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
#workbench .ui-diff__open-link {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 4px;
  background: #0f0f0f;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}
#workbench .ui-diff__open-link:hover { background: #262626; }

@media (min-width: 1024px) and (max-width: 1279px) {
  #workbench .app.ui { grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); }
}
@media (max-width: 1023px) {
  #workbench .app.ui {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 520px;
  }
  #workbench .app > .app__pane--list { max-height: 252px; }
  #workbench .app > .app__pane--list::after { display: none; }
  #workbench .ui-win__side { display: none; }
  #workbench .ui-win__body { grid-template-columns: minmax(0, 1fr); }
  #workbench .app > .app__pane + .app__pane { border-left: 0; border-top: 1px solid var(--u-line); }
}
@media (max-width: 639px) {
  #workbench .app.ui {
    grid-template-rows: minmax(0, 1fr);
    min-height: 430px;
  }
  #workbench .app > .app__pane--list { display: none; }
  #workbench .app > .app__pane + .app__pane { border-top: 0; }
  #workbench .ui-diff__repo,
  #workbench .ui-diff__slash,
  #workbench .ui-diff__dir { display: none; }
  #workbench .ui-diff__ln:nth-of-type(n + 10) { display: none; }
}

/* Screens 3 & 4: #tools (features-2x2 on dark card boxes + sage gradient-mesh panels) */
#tools .section-head { margin-bottom: var(--s-5); }
#tools .panel { --p-h: 268px; }
@media (max-width: 1279px) {
  #tools .panel { --p-h: 210px; }
}
@media (max-width: 639px) {
  #tools { --padt: 80px; --padb: 40px; }
  #tools .section-head { margin-bottom: 16px; }
  #tools .card { --c-pad: 14px; padding: 14px; gap: 6px; }
  #tools .panel { --p-h: 120px; }
  #tools .panel:has(> .dg) { --p-h: 210px; min-height: 210px; }
  #tools .ui-tg:nth-child(n + 3) { display: none; }
  #tools .ui-search__row:nth-child(n + 3) { display: none; }
}
#tools .tools-dg-panel {
  --ink: var(--ground-ink);
  --muted: var(--ground-muted);
  --accent: #1d3518;
  --accent-ink: #ffffff;
  --card: #ffffff;
  --frag: #ffffff;
}
#tools .tools-dg-panel .dg {
  --dg-pulse: #1f4d18;
  --dg-line: rgba(38, 45, 36, 0.34);
  --dg-border: rgba(38, 45, 36, 0.18);
}
#tools .tools-dg-panel .dg-node.is-ink,
#tools .tools-dg-panel .dg-node--core-pill,
#tools .tools-dg-panel .dg-node.is-hit {
  background: var(--dg-node, #ffffff);
  color: var(--dg-ink, #0f0f0f);
  border: 1px solid var(--dg-border, rgba(38, 45, 36, 0.18));
  border-radius: calc(var(--dg-r, 6px) + 2px);
  box-shadow: var(--dg-shadow, 0 1px 2px rgba(0, 0, 0, 0.06));
}
#tools .tools-dg-panel .dg-node.is-ink .dg-label,
#tools .tools-dg-panel .dg-node.is-ink .dg-ic,
#tools .tools-dg-panel .dg-node--core-pill .dg-label,
#tools .tools-dg-panel .dg-node--core-pill .dg-ic {
  color: var(--dg-ink, #0f0f0f);
}
#tools .tools-dg-panel .dg-node--core-pill {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
}
#tools .tools-dg-panel .dg-node--core-pill.is-hit {
  border-color: var(--dg-border, rgba(38, 45, 36, 0.18));
}
#tools .tools-dg-panel .dg-node--core-pill::before,
#tools .tools-dg-panel .dg-node--core-pill::after {
  content: none;
  display: none;
}

/* Screen 5: #families (tabs-tour) */
#families .section-head { margin-bottom: 0; }
#families .tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
}
#families .tab {
  white-space: nowrap;
  padding-inline: 14px;
}
#families .tab[aria-selected="true"] {
  background: var(--action);
  color: var(--action-ink);
  border-color: var(--action);
}
.families-frame {
  --ratio: 0px;
  min-height: 500px;
  align-items: stretch;
  justify-content: stretch;
  padding: 20px;
}
@media (min-width: 1280px) {
  #families .families-frame { min-height: 640px; }
  #families .families-sheet__list { align-content: stretch; grid-auto-rows: 1fr; }
  #families .families-sheet__item { display: flex; }
  #families .families-sheet__row { flex: 1 1 auto; padding: 14px 18px; }
}
.families-screen {
  width: 100%;
  display: flex;
  flex-direction: column;
}
.families-sheet {
  --fx-bg: #ffffff;
  --fx-surface: #f7f7f4;
  --fx-ink: #0f0f0f;
  --fx-muted: #424740;
  flex: 1 1 auto;
  width: 100%;
  background: #ffffff;
  color: #0f0f0f;
  border: 1px solid rgba(15, 15, 15, 0.12);
  border-radius: var(--r-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.families-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid rgba(15, 15, 15, 0.1);
  background: #f7f7f4;
  font: 500 13px/1.3 var(--font-mono);
  color: #3f453d;
}
.families-sheet__list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  margin: 0;
  padding: 0;
  list-style: none;
}
.families-sheet__item {
  border-bottom: 1px solid rgba(15, 15, 15, 0.08);
}
.families-sheet__item:last-child { border-bottom: 0; }
.families-sheet__row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1.3fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: #0f0f0f;
  transition: background-color 140ms var(--ease);
}
.families-sheet__row:hover { background: #f2f5ee; }
.families-sheet__ic {
  width: 18px;
  height: 18px;
  color: #3f453d;
  flex: none;
}
.families-sheet__opn {
  font: 500 13.5px/1.3 var(--font-mono);
  color: #0f0f0f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.families-sheet__pkg {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 3px;
  background: #ecece6;
  color: #262d24;
  font: 500 12px/1.3 var(--font-mono);
  white-space: nowrap;
}
.families-sheet__pkg--trap {
  background: #fee2e2;
  color: #991b1b;
}
.families-sheet__spec {
  font: 400 13px/1.35 var(--font-mono);
  color: #424740;
  text-align: right;
  white-space: nowrap;
}
@media (max-width: 639px) {
  #families .tabs { gap: 6px; overflow-x: auto; }
  #families .tab { min-height: 44px; padding-inline: 11px; font-size: 13px; }
  .families-frame { min-height: 410px; padding: 12px; }
  .families-sheet__item:nth-child(n + 7) { display: none; }
  .families-sheet__row {
    grid-template-columns: 16px minmax(0, 1fr) auto;
    min-height: 48px;
    padding: 10px 12px;
    gap: 4px 8px;
  }
  .families-sheet__spec {
    grid-column: 2 / -1;
    text-align: left;
    font-size: 13px;
  }
}

/* Screen 6: #verify (iris-opens on ground-inverse) */
#verify .section-head { margin-bottom: 0; }
.verify-frame {
  --ratio: 0px;
  min-height: 488px;
  align-items: stretch;
  justify-content: stretch;
  padding: 20px;
  background: var(--surface);
}
.verify-guides {
  --fx-bg: #ffffff;
  --fx-surface: #f7f7f5;
  --fx-ink: #0f0f0f;
  --fx-muted: #4a4a46;
  width: 100%;
  background: #ffffff;
  color: #0f0f0f;
  border: 1px solid rgba(15, 15, 15, 0.12);
  border-radius: var(--r-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.verify-guides__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid rgba(15, 15, 15, 0.1);
  background: #f7f7f5;
  font: 500 13px/1.3 var(--font-mono);
  color: #42423e;
}
.verify-guides__list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  margin: 0;
  padding: 0;
  list-style: none;
}
.verify-guides__li {
  border-bottom: 1px solid rgba(15, 15, 15, 0.08);
}
.verify-guides__li:last-child { border-bottom: 0; }
.verify-guides__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 14px;
  align-items: center;
  padding: 11px 16px;
  transition: background-color 140ms var(--ease);
}
.verify-guides__item:hover { background: #f5f7f2; }
.verify-guides__title {
  font: 500 15px/1.35 var(--font-text);
  color: #0f0f0f;
}
.verify-guides__cat {
  grid-column: 1;
  font: 400 13px/1.3 var(--font-mono);
  color: #52524e;
}
.verify-guides__time {
  grid-column: 2;
  grid-row: 1 / 3;
  font: 500 13px/1.2 var(--font-mono);
  color: #3f3f3c;
  white-space: nowrap;
}
.verify-guides__foot {
  padding: 12px 16px;
  background: #f7f7f5;
  border-top: 1px solid rgba(15, 15, 15, 0.08);
}
@media (max-width: 639px) {
  .verify-frame { min-height: 400px; padding: 12px; }
  .verify-guides__item { min-height: 52px; padding: 10px 14px; }
  .verify-guides__foot { padding: 10px 14px; }
}

/* Screen 7: #faq visual compatibility matrix */
.faq-matrix {
  margin-top: var(--s-5);
  width: 100%;
  background: #171717;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--r-md);
  padding: 14px;
}
.faq-matrix svg {
  width: 100%;
  height: auto;
  display: block;
}
@media (min-width: 1280px) {
  #faq .faq > .faq__item {
    padding-block: 26px;
  }
  #faq .faq-matrix {
    min-height: 310px;
    padding: 18px;
    display: flex;
    align-items: center;
  }
}

/* Screen 8: footer.closing (close-word + footer-columns, 14-char display name) */
footer.closing > .wrap { row-gap: var(--s-6); }
.close__word {
  font-size: clamp(32px, 10.2vw, 152px);
  line-height: 0.9;
}
.closing__links { gap: var(--s-5); }
.closing__links > .grid { row-gap: var(--s-5); }
.footer .nav__logo .mark--initial {
  width: 22px;
  height: 22px;
  font-size: 13px;
  margin-right: 0;
}
.footer__legal {
  margin-top: 0;
  padding-top: var(--s-4);
  gap: var(--s-3) var(--s-5);
}
.footer__legal-links {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-4);
}
.footer__legal-links a { color: var(--ink); }
.footer__legal-links a:hover { color: var(--action); }
.footer__disclaimer {
  flex: 1 0 100%;
  width: 100%;
  max-width: none;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
}
@media (max-width: 639px) {
  footer.closing > .wrap { row-gap: var(--s-6); }
  .close__word { font-size: clamp(32px, 10.2vw, 52px); }
}
`;
