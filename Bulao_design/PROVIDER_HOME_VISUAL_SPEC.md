# Provider Home Screen - Visual Specification Guide

## 🎨 Screen Layout (341×700px Reference)

```
┌─────────────────────────────────────────────────┐
│  ≈ 90px  ┌───────────────────────────────┐     │
│   HEADER │ Bulao  📍 Location   🔔  👤  │     │
│          │ Good things nearby            │     │
│          └───────────────────────────────┘     │
├─────────────────────────────────────────────────┤
│                                                 │
│         ╔═══════════════════════════╗          │
│ ≈200px  ║   HERO IMAGE AREA         ║          │
│         ║   (provider_hero_image)   ║          │
│         ╚═══════════════════════════╝          │
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐ │
│  │  ⊕  Post a Job                        →  │ │
│  │     Find someone nearby in minutes       │ │
│  └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  Your Hirings                      See all →   │
│                                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│  │ 12 │ │ 6  │ │ 18 │ │ 4  │ │ 9  │         │
│  │Jobs│ │Act-│ │Int-│ │Hir-│ │Com-│         │
│  │Pstd│ │ive │ │estd│ │ed  │ │pld │         │
│  └────┘ └────┘ └────┘ └────┘ └────┘         │
│                                                 │
├─────────────────────────────────────────────────┤
│  Recent Jobs                       See all →   │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ [IMG] Fix tap leakage               ›  │  │
│  │       📍 1.2 km away                   │  │
│  │       Plumbing          ● Open         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐  │
│  │ Bulao  Home   ╭───╮  Activity  Profile │  │
│  │              │  +  │                     │  │
│  │              ╰───╯                       │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Component Dimensions & Spacing

### Top Header (90px total height)
```
┌─────────────────────────────────────────────────┐
│ Padding: 16px horizontal, 10px top              │
│                                                 │
│ [Bulao]          [📍 Location]        [🔔] [👤]│
│  28px             13px, pill          40px each │
│  -1.5 letter      rounded 24px        circular  │
│  weight 900       green tint                    │
│                                                 │
│ [Good things]                                   │
│  11px, muted                                    │
└─────────────────────────────────────────────────┘
```

### Hero Section (~200-220px based on screen width)
```
┌─────────────────────────────────────────────────┐
│ Aspect Ratio: 1.6 (width : height)             │
│ Width: 100%                                     │
│ Height: Auto (based on aspect ratio)            │
│ Border Radius: 0 (full width)                   │
│ Object Fit: cover                               │
│                                                 │
│ [provider_hero_image.png]                       │
│                                                 │
└─────────────────────────────────────────────────┘
Margin Top: 16px
```

### Post Job CTA (~88px height)
```
┌─────────────────────────────────────────────────┐
│ Padding: 20px                                   │
│ Border Radius: 20px                             │
│ Background: #FFFFFF                             │
│ Shadow: soft (opacity 0.06)                     │
│                                                 │
│ ╭────╮  Post a Job                          →  │
│ │ + │  19px, weight 700                         │
│ ╰────╯  Find someone nearby in minutes          │
│ 48px    13px, muted                             │
│ circle                                          │
└─────────────────────────────────────────────────┘
Margin: 16px horizontal, 24px top
```

### Your Hirings Section
```
┌─────────────────────────────────────────────────┐
│ Your Hirings                       See all →    │
│ 20px, weight 700                   14px, link   │
│                                                 │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──│
│ │   12   │ │   6    │ │   18   │ │  4   │ │ 9│
│ │  24px  │ │  24px  │ │  24px  │ │ 24px │ │24│
│ │ weight │ │ weight │ │ weight │ │weight│ │we│
│ │  700   │ │  700   │ │  700   │ │ 700  │ │70│
│ │        │ │        │ │        │ │      │ │  │
│ │ Jobs   │ │ Active │ │ Inter- │ │Hired │ │Co│
│ │ Posted │ │        │ │ ested  │ │      │ │mp│
│ │ 11px   │ │ 11px   │ │ 11px   │ │11px  │ │11│
│ │        │ │        │ │        │ │      │ │  │
│ └────────┘ └────────┘ └────────┘ └──────┘ └──│
│   80px      80px       80px       80px    80px │
│   Pad:16    Pad:16     Pad:16     Pad:16  16px │
│   R:16      R:16       R:16       R:16    R:16 │
│                                                 │
│ Gap between cards: 12px                         │
│ Horizontal scroll: yes (if needed)              │
└─────────────────────────────────────────────────┘
Margin: 16px horizontal, 32px top
```

### Recent Jobs Section
```
┌─────────────────────────────────────────────────┐
│ Recent Jobs                        See all →    │
│ 20px, weight 700                   14px, link   │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ ┌────┐ Fix tap leakage                  ›  ││
│ │ │    │ 16px, weight 700                     ││
│ │ │IMG │                                      ││
│ │ │70px│ 📍 1.2 km away                       ││
│ │ │    │ 13px, muted                          ││
│ │ └────┘                                      ││
│ │ R:12   [Plumbing]           ● Open          ││
│ │        chip 11px            12px, green     ││
│ │        green tint           status pill     ││
│ │                                             ││
│ │ Card Padding: 14px                          ││
│ │ Card Radius: 18px                           ││
│ │ Card Shadow: soft (opacity 0.05)            ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Gap between cards: 12px                         │
└─────────────────────────────────────────────────┘
Margin: 16px horizontal, 32px top
```

### Bottom Navigation (~80px height + safe area)
```
┌─────────────────────────────────────────────────┐
│                    ╭─────╮                      │
│                    │  +  │  Elevated -28px      │
│                    │ 32px│  56×56 circle        │
│                    ╰─────╯  Green bg            │
│ ┌───────────────────────────────────────────┐  │
│ │                                           │  │
│ │ Bulao  Home    [CENTER]   Activity Profile│  │
│ │ 24px   24px      -        24px     24px   │  │
│ │ icon   icon    (above)    icon     icon   │  │
│ │                                           │  │
│ │ 10px   10px               10px     10px   │  │
│ │ text   text               text     text   │  │
│ │ (gray) (green=active)     (gray)   (gray) │  │
│ │                                           │  │
│ └───────────────────────────────────────────┘  │
│ Padding: 12px top, 20px bottom, 8px horizontal │
│ Background: #FFFFFF                            │
│ Border Top: 1px, #C8D8CE                       │
│ Shadow: top shadow (opacity 0.08)              │
└─────────────────────────────────────────────────┘
Position: Fixed bottom
```

---

## 📐 Measurement Reference

### Padding Scale
```
Screen edges:     16px
Section spacing:  24px or 32px
Card internal:    14-20px
Chip internal:    10-16px
```

### Gap Scale
```
Header elements:     6-12px
Stat cards:          12px
Job card elements:   6-14px
Section to heading:  16px
```

### Font Sizes
```
Bulao logo:         28px
Section heading:    20px
Post Job heading:   19px
Job title:          16px
Body text:          13-14px
Metadata:           11-13px
Stats number:       24px
Stats label:        11px
Nav label:          10px
```

### Border Radius
```
Location pill:   24px (fully rounded sides)
CTA card:        20px
Job card:        18px
Stats card:      16px
Job image:       12px
Chip:            12px
Avatar:          50% (circular)
Nav center btn:  50% (circular)
Nav button:      40px diameter (circular)
```

---

## 🎨 Color Palette

### Backgrounds
```css
Screen background:      #F7FAF7  /* Light warm off-white */
Card background:        #FFFFFF  /* Pure white */
Location pill bg:       #E8F5EE  /* Light green tint */
Post Job CTA bg:        #FFFFFF  /* White */
```

### Statistics Card Colors
```css
Jobs Posted:    #E3F2FD  /* Pale blue */
Active:         #FFF9E6  /* Pale yellow */
Interested:     #F3E5F5  /* Pale lavender */
Hired:          #E8F5E9  /* Pale green */
Completed:      #FFE8E8  /* Pale warm pink */
```

### Text Colors
```css
Primary (Ink):        #0D2318  /* Very dark green-black */
Primary (Green):      #1A6645  /* Rich forest green */
Muted:                #3D5246  /* Dark readable gray-green */
Muted Light:          #6B8275  /* Lighter gray for placeholders */
```

### Accent Colors
```css
Primary Green:        #1A6645
Green Light:          #E8F5EE
Lime Border:          #C8E87A
Error Red:            #E74C3C  /* Notification dot */
Success Green:        #4CAF50  /* Status indicator */
Border Line:          #C8D8CE
```

---

## 🔲 Interactive States

### Pressable Elements

#### Post Job CTA
```
Default:
  - opacity: 1
  - transform: scale(1)

Pressed:
  - opacity: 0.95
  - transform: scale(0.98)
  - Duration: instant
```

#### Statistics Cards
```
Default:
  - Background: pastel color
  - No border

Pressed:
  - opacity: 0.8
  - slight scale reduction
```

#### Job Cards
```
Default:
  - opacity: 1
  - shadow present

Pressed:
  - opacity: 0.95
  - shadow slightly reduced
```

#### Bottom Navigation Items
```
Active (Home):
  - Icon color: #1A6645 (green)
  - Text color: #1A6645 (green)
  - Text weight: 700 (bold)

Inactive:
  - Icon color: #6B8275 (muted light)
  - Text color: #6B8275 (muted light)
  - Text weight: 600

Center Button:
  - Always: Green (#1A6645)
  - Elevated above bar
  - Enhanced shadow
```

---

## 📊 Component Priority Hierarchy

### Visual Dominance Order
1. **Post a Job CTA** (most prominent)
   - Large
   - Central position
   - White background stands out
   - Green accent color

2. **Bottom Navigation Center Button**
   - Elevated
   - Bright green
   - Large size
   - Enhanced shadow

3. **Your Hirings Statistics**
   - Colorful cards
   - Large numbers
   - Eye-catching

4. **Section Headings**
   - Bold
   - Good contrast

5. **Recent Jobs**
   - Clean cards
   - Clear information

6. **Header Elements**
   - Subtle but accessible
   - Not competing for attention

---

## 🖼️ Image Guidelines

### Hero Image
```
File: provider_hero_image.png
Location: mobile/assets/images/provider/
Recommended size: 1200×750px (1.6 ratio)
Format: PNG or JPG
Quality: High (80-90%)
File size: <500KB (optimize)

Display:
  - Width: 100%
  - Height: Auto (aspect ratio)
  - Object fit: cover
  - Position: Below header
```

### Job Card Images
```
Size: 70×70px display
Recommended actual: 140×140px (@2x)
Format: JPG or PNG
Quality: Medium-high (70-80%)
Border radius: 12px
Fallback: Category icon from Ionicons
```

### Profile Avatar
```
Size: 40×40px display
Border: 2px solid #1A6645
Border radius: 50% (circular)
Background: #E8F5EE if no image
Icon: person (Ionicons)
```

---

## ♿ Accessibility

### Touch Targets
```
Minimum: 44×44px (iOS HIG)
Preferred: 48×48px or larger

Current implementation:
  - Location pill: 42px height ✅
  - Notification bell: 40px diameter (needs 44px)
  - Profile avatar: 40px diameter (needs 44px)
  - Post Job CTA: Full card (plenty) ✅
  - Stats cards: 80px+ width ✅
  - Job cards: Full card ✅
  - Bottom nav items: 60px width ✅
  - Bottom nav center: 56px diameter ✅
```

### Labels
```
All Pressable elements have:
  - accessibilityRole="button"
  - accessibilityLabel (where needed)
  - accessibilityState (for selected/disabled)
```

### Text Contrast
```
All text meets WCAG AA standards:
  - Ink (#0D2318) on Paper: ✅ Excellent
  - Green (#1A6645) on White: ✅ AAA
  - Muted (#3D5246) on White: ✅ AA
```

---

## 📱 Responsive Breakpoints

### Mobile Portrait (Default)
```
Width: 341px - 428px
Padding: 16px horizontal
Hero: Aspect ratio 1.6
Stats: Horizontal scroll if needed
Layout: Single column
```

### Mobile Landscape
```
Width: 568px - 926px
Padding: 24px horizontal
Hero: Aspect ratio maintained
Stats: All visible, no scroll
Layout: Single column, wider
```

### Tablet Portrait
```
Width: 768px - 834px
Padding: 32px horizontal
Max width: 700px, centered
Hero: Constrained width
Stats: Comfortable spacing
Layout: Constrained center column
```

### Tablet Landscape / Desktop
```
Width: 1024px+
Padding: 48px horizontal
Max width: 900px, centered
Hero: Constrained, centered
Stats: Generous spacing
Layout: Constrained center column
Alternative: Desktop provider layout
```

---

## 🎭 Visual Style Guide

### Overall Feel
```
✅ Clean       - Minimal elements, clear hierarchy
✅ Soft        - Gentle shadows, pastel colors
✅ Spacious    - Generous padding and gaps
✅ Light       - Bright, airy, off-white background
✅ Premium     - Quality shadows, smooth interactions
```

### What to Avoid
```
❌ Heavy shadows
❌ Dark backgrounds
❌ Saturated colors
❌ Crowded layouts
❌ Multiple CTAs competing
❌ Admin dashboard aesthetics
❌ Analytics graphs on home
❌ Unnecessary decorative elements
```

---

## 🔍 Implementation Verification Checklist

### Visual Match
- [ ] Header height ~90px ✅
- [ ] Bulao logo size and weight ✅
- [ ] Location pill style ✅
- [ ] Notification dot present ✅
- [ ] Hero aspect ratio correct ⏳ (pending image)
- [ ] Post Job CTA dominant ✅
- [ ] Five statistics with correct colors ✅
- [ ] Job card layout matches ✅
- [ ] Bottom nav center button elevated ✅
- [ ] Active nav item highlighted ✅

### Spacing
- [ ] Header top padding comfortable ✅
- [ ] Hero to Post Job: 24px ✅
- [ ] Post Job to Hirings: 32px ✅
- [ ] Hirings to Recent: 32px ✅
- [ ] Card internal padding correct ✅
- [ ] Screen edge padding: 16px ✅

### Colors
- [ ] Background: #F7FAF7 ✅
- [ ] Cards: White ✅
- [ ] Primary green used correctly ✅
- [ ] Statistics pastel colors ✅
- [ ] Text contrast sufficient ✅

### Interactions
- [ ] All cards tappable ✅
- [ ] Press states work ✅
- [ ] Navigation routes functional ✅
- [ ] Scroll smooth ✅

### Responsive
- [ ] No hardcoded dimensions ✅
- [ ] Hero scales properly ✅
- [ ] Stats scroll on narrow screens ✅
- [ ] Content centered on wide screens ⏳

---

## 📸 Reference Screenshot Analysis

### Top Section (Header + Hero)
```
Height ratio: ~40% of screen
Focus: Location awareness, hero visual
Key elements: Logo, location, notifications, hero
```

### Middle Section (CTA + Statistics)
```
Height ratio: ~35% of screen
Focus: Primary action, provider stats
Key elements: Post Job CTA, 5 stat cards
```

### Bottom Section (Recent Jobs + Nav)
```
Height ratio: ~25% of screen
Focus: Quick access, navigation
Key elements: Job cards, bottom nav
```

---

**This specification is derived from the 341×700px reference and adapted for responsive implementation.**

**Status:** Visual specification complete for phases 1-13
**Last Updated:** Phase 1 implementation complete
**Next:** Hero image integration + data connection
