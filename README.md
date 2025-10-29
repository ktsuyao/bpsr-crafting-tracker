Site is here: https://bpsr-crafting-tracker.tiiny.site

## 📦 Crafting Tracker

A modular, yield-aware crafting tracker designed for games, journaling rituals, and technical clarity. Built with JavaScript and Firebase, it supports recursive recipes, raw material summaries, and emotionally resonant workflows.

---

### 🌟 Features

- ** Recipe Database ** - collaborative effort by adding recipes that are not existing in the DB yet. Any crafting recipe that has been entered will be stored and can be loaded when searched.
- ** Auto-calculator ** - auto-calculates the materials and raw materials needed for the recipe
- ** Recipe within a recipe ** - automatically saves the sub-recipes as actual recipes that can be loaded when searched

Upcoming Features (not implemented yet):
- ** Yield-aware ** - can set up yields and materials will be adjusted depending on the desired result quantity 

---

### 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS  
- **Database**: Firebase Firestore  

---

### 🚀 Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/your-username/crafting-tracker.git
   cd crafting-tracker
   ```

2. Add your Firebase config to the script:
   ```js
   const firebaseConfig = { ... };
   ```

3. Open `index.html` in your browser.

---

### 📐 Yield Logic - to be implemented

```js
desiredOutput = qty × multiplier
craftsNeeded = ceil(desiredOutput / yield)
rawRequired = qty × craftsNeeded
```

- Crafted nodes show desired output  
- Raw nodes show required input  
- Preview reflects parent yield for emotional clarity

---

### 📖 Example

```text
- Refined Yarn × 5 🛠️ (needs 2 crafts, yield 3)
  - Flax × 2 🌱 (needs 2 crafts, yield 3)
```

---
### 📄 License

MIT — free to use, adapt, and share.

