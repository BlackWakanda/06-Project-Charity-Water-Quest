# charity: water – Water Quest Game - Carlton Tukov

Charity: WaterTap is a browser game inspired by charity: water's mission. Players tap a pump rapidly to fill a water meter, clear rounds, and progress through increasing difficulty tiers before time runs out.
## What’s Already Done

The starter files already include:

- A **heading and tagline**
- A **start button**
- A **game container** displaying a grid
- A **placeholder timer and score** (not functional yet)
- A **logo image** from charity: water
- Working code that:
  - Starts the game when the start button is clicked  
  - Makes Jerry Cans pop up randomly

## What You Need to Add

The fundamental mechanics are unchanged: players continuously tap to fill
a water tank, working towards a goal that benefits the village. The game is
designed to increase in difficulty over time. I introduced new
enhancements, such as difficulty modes, to vary gameplay and keep it
unique, preventing it from becoming boring after a short period.


### Game Functionality

This project was expanded from a basic starter into a complete, playable arcade-style experience with:

1. A full gameplay loop with start, play, win/lose, replay, and reset flows.
2. Tier-based progression where each tier increases challenge.
3. Difficulty selection (Easy, Normal, Expert) with distinct tuning values.
4. A leak system that drains water over time and creates pressure to keep tapping.
5. Obstacle hazards that appear in higher tiers and reduce purity if missed.
6. Round progression requirements per tier before leveling up.
7. HUD tracking for timer, purity %, current tier, and tier progress.
8. End overlays with outcome messaging and a direct donation link.
9. Mission-focused educational content about clean water access.
10. Responsive, branded UI using charity: water-inspired colors, typography, and animated effects.

## Gameplay Summary

1. Open the game and press Start Game.
2. Read the mission card and continue to difficulty selection.
3. Pick Easy, Normal, or Expert to begin immediately.
4. Tap the pump quickly to increase the water meter.
5. Counter tier leak pressure and avoid contamination obstacles in later tiers.
6. Reach 100% to clear rounds and advance.
7. Complete all required rounds through the final tier to win.

If the timer reaches 0 before clearing the round, the run ends in Game Over.

## Project Structure

1. `index.html` - layout, overlays, HUD, controls, mission content, and links.
2. `style.css` - branded visual system, responsive layout, and motion effects.
3. `script.js` - game engine, difficulty presets, progression, obstacle handling, and events.
4. `img/` - brand assets (including logo).

### Visual Styling

- **Add charity: water branding**
  
  - Use the provided logo  
  - Use the [charity: water brand guidelines](https://drive.google.com/file/d/1ct4zYRIwHAtxoNQoeaVwWYPdnruSC6sr/view) to stay on-brand with colors and styling
  - Add styling rules to ensure your game layout adjusts well across different screen sizes

These are the minimum requirements, but if you'd like an additional challenge go ahead and give the LevelUps a shot! For example, you could add logic to decrease the user's score if they miss a jerry can. Have fun and make the game your own!

If you have any questions or need any assistance with your code, reach out to the HelpHub or attend a Drop-In Hour. You got this!!

