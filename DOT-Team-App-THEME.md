# DOT Team App — Theme Guide

> **For Claude:** This is the design system of the DOT Team App (DOT Advertising / Zeebas Cluster LLP).
> Anything you build or change must follow it exactly — same colours, same glass cards, same fonts,
> same radii, same spacing. Do **not** introduce new colours, fonts, light backgrounds or flat
> Material-style components. When unsure, copy an existing component's CSS from below.

---

## 1. Look & feel in one line

**Dark, Apple-iOS-style "liquid glass".** Near-black background with soft blue and purple glows,
translucent frosted-glass cards with a hairline white border, and Apple system colours
(blue / green / orange / red / purple) used as accents. It is **dark mode only**.

---

## 2. Colour tokens

```css
:root{
  --blue:#0A84FF;     /* primary — buttons, active tab, links, focus */
  --green:#30D158;    /* success, present, paid, check-in, toggles ON */
  --orange:#FF9F0A;   /* warning, pending, break, late */
  --red:#FF453A;      /* danger, absent, delete, logout, notification dot */
  --purple:#BF5FFF;   /* admin / special / secondary accent */
  --text:#F5F5F7;     /* main text */
  --muted:rgba(245,245,247,0.45);   /* secondary text, labels */
  --faint:rgba(245,245,247,0.1);    /* section labels, dividers */
}
```

| Use | Value |
|---|---|
| App background (staff app / PWA) | `#040408` |
| Admin dashboard background | `#050508` |
| Page outer background (desktop around phone) | `#0D0D0F` |
| `theme-color` / manifest | `#040408` |
| Dropdown option background | `#1A1A2E` |
| Modal background | `rgba(10,10,22,0.96)` |
| Sidebar background | `rgba(5,5,14,0.75)` + blur 32px |
| Bottom nav background | `rgba(4,4,8,0.8)` + blur 28px |
| Placeholder text | `rgba(245,245,247,0.25–0.28)` |
| Inactive nav icon | `rgba(235,235,245,0.35)` |
| Hairline border | `rgba(255,255,255,0.06 – 0.12)`, **0.5px** thick |

**Accent tint rule** — every accent is used in three strengths:
- background: accent at **0.12–0.15** alpha
- border: accent at **0.2–0.35** alpha, 0.5px
- text: the solid accent

e.g. green → `background:rgba(48,209,88,0.15); border:0.5px solid rgba(48,209,88,0.28); color:#30D158;`

RGB values for tints: blue `10,132,255` · green `48,209,88` · orange `255,159,10` · red `255,69,58` · purple `191,95,255`.

---

## 3. Background glow

Admin dashboard:
```css
body{
  background:#050508;
  background-image:
    radial-gradient(ellipse at 15% 10%, rgba(10,40,100,0.5) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 90%, rgba(80,10,120,0.35) 0%, transparent 50%);
}
.orb{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0;}
.orb1{width:500px;height:500px;background:radial-gradient(circle,rgba(10,80,200,0.16),transparent 70%);top:-150px;left:-100px;}
.orb2{width:400px;height:400px;background:radial-gradient(circle,rgba(100,20,180,0.12),transparent 70%);bottom:-100px;right:-50px;}
```

Staff / mobile app:
```css
.pbg{background:
  radial-gradient(ellipse at 20% 0%, #0D1F3C, transparent 50%),
  radial-gradient(ellipse at 80% 100%, #1A0A2E, transparent 50%),
  #040408;}
```
Blue glow top-left, purple glow bottom-right — always.

---

## 4. Typography

| App | Font |
|---|---|
| Admin dashboard | **DM Sans** 300/400/500, numbers/IDs in **DM Mono** 400 |
| Staff app (phone) | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif` |
| Brand wordmark ("DOT ADVERTISING", "TEAM APP") | DM Sans, uppercase, letter-spacing 3.5–6px |
| Timers / clocks | `monospace`, weight 700, letter-spacing 1px |

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
```

Scale (dashboard):
- Page title `19px / 500 / letter-spacing -0.3px`
- Page subtitle `13px / 300 / --muted`
- Section title `14px / 500`
- Body `13–14px`, table cells `13px / 300`
- Stat value `22px / 500 / letter-spacing -0.5px`
- Labels `10px / uppercase / letter-spacing 0.6px / --muted`
- Sidebar group label `9px / uppercase / letter-spacing 1.2px / --faint`

Weights stay light: mostly **300–500**. 600–700 only for primary buttons and key money figures.
Inputs on mobile are always **16px** (stops iOS zoom).

---

## 5. Glass surfaces

```css
/* main card */
.g {background:rgba(255,255,255,0.05);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
    border:0.5px solid rgba(255,255,255,0.1);border-radius:13px;}
/* small / nested card */
.gs{background:rgba(255,255,255,0.04);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;}
/* modal */
.ov   {position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);z-index:200;}
.modal{background:rgba(10,10,22,0.96);backdrop-filter:blur(32px);border:0.5px solid rgba(255,255,255,0.12);
       border-radius:22px;width:520px;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.7);}
```

Coloured stat cards (gradient tint):
```css
.sg{background:linear-gradient(135deg,rgba(48,209,88,0.11),rgba(48,209,88,0.03));border:0.5px solid rgba(48,209,88,0.16);}
.sb{background:linear-gradient(135deg,rgba(10,132,255,0.11),rgba(10,132,255,0.03));border:0.5px solid rgba(10,132,255,0.16);}
.so{ ...orange 255,159,10 }   .sr{ ...red 255,69,58 }
```

> Performance note: avoid `backdrop-filter` on full-screen animated overlays (it made the
> salary confetti lag on phones). Use a plain `rgba(0,0,0,0.7)` there.

---

## 6. Radius scale

| Element | Radius |
|---|---|
| Pills / badges / tabs | `999px` (full) |
| Small card, dashboard buttons & inputs | `10px` |
| Main card | `13px` |
| Mobile inputs | `12px` |
| Mobile buttons, stat card | `14px` |
| Task card | `16px` |
| Modal / photo upload | `22px` |
| Avatars | `50%` |

---

## 7. Components

**Primary button**
```css
.btn{background:linear-gradient(135deg,#0A84FF,#0A60CC);color:#fff;border:none;border-radius:10px;
     padding:9px 18px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(10,132,255,0.35);}
/* mobile */
.btn-p{background:linear-gradient(135deg,#0A84FF,#0A60CC);color:#fff;border:none;border-radius:14px;
       padding:15px;font-size:16px;font-weight:600;width:100%;box-shadow:0 6px 20px rgba(10,132,255,0.38);}
.btn-p:active{transform:scale(0.96);opacity:0.85;}
```
**Ghost button**
```css
.btn-g{background:rgba(255,255,255,0.06);color:var(--text);border:0.5px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 14px;}
```
**Danger button**
```css
.btn-red{background:rgba(255,69,58,0.14);color:#FF453A;border:0.5px solid rgba(255,69,58,0.22);border-radius:10px;}
```
**Tinted action button** (Break / Check-out / Office work): accent tint bg 0.12, border 0.35, solid accent text, weight 600–700, radius 12–14px.

**Input**
```css
.inp{background:rgba(255,255,255,0.07);border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;
     color:#F5F5F7;padding:10px 14px;font-size:14px;font-weight:300;outline:none;}
.inp:focus{border-color:#0A84FF;}
```

**Status pills**
```css
.pg{background:rgba(48,209,88,0.15);color:#30D158;border:0.5px solid rgba(48,209,88,0.28);}   /* green  */
.pr{background:rgba(255,69,58,0.15);color:#FF453A;border:0.5px solid rgba(255,69,58,0.28);}   /* red    */
.po{background:rgba(255,159,10,0.15);color:#FF9F0A;border:0.5px solid rgba(255,159,10,0.28);} /* orange */
.pb{background:rgba(10,132,255,0.15);color:#0A84FF;border:0.5px solid rgba(10,132,255,0.28);} /* blue   */
.pp{background:rgba(191,95,255,0.15);color:#BF5FFF;border:0.5px solid rgba(191,95,255,0.28);} /* purple */
/* shared */ display:inline-flex;padding:4px 11px;border-radius:999px;font-size:10px;font-weight:500;
```

**Tabs / segmented**
```css
.task-tab{background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:6px 16px;font-size:12px;color:var(--muted);}
.task-tab.active{background:rgba(10,132,255,0.18);border-color:rgba(10,132,255,0.35);color:#0A84FF;font-weight:500;}
```

**Sidebar item (admin)**
```css
.ni{padding:9px 10px;border-radius:11px;color:var(--muted);font-size:13px;}
.ni:hover{background:rgba(255,255,255,0.06);color:var(--text);}
.ni.active{background:rgba(10,132,255,0.15);color:#0A84FF;border:0.5px solid rgba(10,132,255,0.18);}
```
Sidebar width 210px, fixed, frosted.

**Bottom nav (staff app)** — frosted `rgba(4,4,8,0.8)`, blur 28px, top hairline; icons + 9px labels, inactive `rgba(235,235,245,0.35)`, active `#0A84FF`. Red unread dot 7px with `1.5px solid #040408` ring.

**Toggle** — 42×24 track `rgba(255,255,255,0.1)`, ON = `#30D158`, white 18px thumb with shadow.

**Table** — header 10px uppercase muted, cells 13px/300, row dividers `rgba(255,255,255,0.04)`, hover `rgba(255,255,255,0.015)`.

**Task card priority** — left border 3px: high `#FF453A`, medium `#FF9F0A`, low `#30D158`. Done = opacity 0.55.

**Toast** — bottom-right, `rgba(10,10,20,0.9)` + blur, green border 0.3, green text, radius 12px.

**Logo tile** — 40×40, radius 13px, `linear-gradient(145deg,rgba(10,132,255,0.85),rgba(10,60,180,0.9))`, glow `0 8px 24px rgba(10,132,255,0.35)`, inset top highlight.

---

## 8. Motion

- Page change: fade-up `translateY(8px) → 0`, 0.22s ease; directional slide 60px, 0.25s `cubic-bezier(0.25,0.46,0.45,0.94)`.
- Mobile screens slide in 100%, 0.28s same curve.
- Tap feedback: scale 0.95–0.97 then bounce back (`cubic-bezier(0.36,0.07,0.19,0.97)`), 0.25–0.3s.
- Cards stagger in with `sectionIn` (10px fade-up, 0.3s).
- Skeleton loaders pulse opacity 0.5 ↔ 1.
- Hover transitions 0.15s. Keep everything subtle and quick.

---

## 9. Layout & responsive

- Admin: fixed 210px sidebar + main area `padding:18px 20px 32px`. Breakpoints 1366 / 1024 / 680 / 600 / 400px; on mobile the sidebar becomes a bottom nav and the toast moves above it.
- Staff app: phone-first single column; uses `env(safe-area-inset-*)`; ≥900px gets a desktop staff layout.
- Section padding `14px 16px`, gap between cards `10px`.
- Money shown as `₹` with Indian grouping (`₹17,053.85`).

---

## 10. Do / Don't

✅ Dark background, frosted glass, 0.5px hairline borders, Apple system accents, DM Sans / SF, soft shadows, rounded corners.
✅ Status colours stay meaningful: green = good/paid/present, orange = pending/warning, red = danger/absent, blue = primary/info, purple = admin/special.
❌ No white or light backgrounds, no light mode.
❌ No new brand colours, no Material/Bootstrap look, no heavy solid borders, no sharp corners.
❌ No bold 700+ everywhere — keep text light.
❌ No emoji-heavy UI beyond what already exists.
