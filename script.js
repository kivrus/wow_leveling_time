# WoW Classic Leveling Time Calculator (Vanilla 1–60)

![WoW Classic Icon](https://raw.githubusercontent.com/YourRepo/assets/main/wow-icon.png)

**Author:** [Kivrus](https://www.youtube.com/yourchannel) ✨

A lightweight web tool to estimate how long it will take your character to level from your current level to 60 in World of Warcraft Classic, factoring in your play speed and rested XP bonus.

---

## 🔍 Project Overview

* **Vanilla stack**: Plain HTML, CSS, and JavaScript—no build tools required.
* **Rested XP bonus**: Up to +40% XP gain when your character is offline/resting.
* **Segment-based rates**: Adjusts XP/hour benchmarks for levels 1–20, 21–40, and 41–60.
* **Interactive chart**: Visualizes your expected level progression by day.

## 📹 Demo Video

You can link your YouTube channel or a demo video here:

```md
[![Watch me on YouTube](https://img.shields.io/badge/YouTube-Channel-red)](https://www.youtube.com/yourchannel)
```

Replace `https://www.youtube.com/yourchannel` with your actual channel URL.

## 🔧 How It Works

The calculator first determines your average XP per hour from the XP you’ve already earned and the time you’ve spent playing.
It applies a rested XP bonus—reflecting faster gains on kills when your character has been offline for a while—up to a predefined cap.
Next, it adjusts each level’s pacing based on community benchmark rates to account for varying difficulty across levels.
Finally, it adds up the time needed for all remaining levels and converts the total into days based on your daily playtime setting.

---

## 🚀 Installation & Usage

1. **Clone the repo**:

   ```bash
   git clone https://github.com/YourRepo/wow-level-calculator.git
   cd wow-level-calculator
   ```

2. **Open in your browser**:

   Double-click `index.html` or use your browser’s **File → Open** menu.

3. **Enter your data**:

   * **Current Level** (1–59)
   * **Time Already Played** (total hours of XP farming)
   * **Hours Per Day** (planned average daily playtime)

4. **Click Calculate** to see:

   * Remaining XP and time to reach level 60
   * Breakdown in days and hours
   * A day-by-day leveling chart

---

## ✍️ About the Author

**Kivrus** is a gamer and front-end developer who loves World of Warcraft Classic. This tool was created to help the community plan their leveling journey and make the best use of rested XP.

---

## 📄 License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
