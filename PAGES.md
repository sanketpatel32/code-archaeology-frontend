# 📚 Page Guide & Features

This document details the various analysis views available in the Code Archaeology dashboard.

## 🧭 Dashboard Navigation

### 1. Overview (`/`)
The command center of your repository analysis.
- **Key Metrics**: Delivery tempo (commits/week), Change load (churn), and Risk index.
- **Action Center**: Input field to start analyzing a new repository.
- **Activity Lens**: High-level chart showing commit volume vs. code churn.
- **Quick Links**: Access to the top 3 high-risk files (hotspots).

### 2. Hotspots (`/hotspots`)
Visualizes where development effort is concentrated.
- **Interactive Treemap**: Rectangles represent files. Size = Lines of Code, Color = Complexity.
- **Purpose**: Quickly identify large, complex files that change frequently.
- **Strategy**: Files in the top-left (red/orange) are prime candidates for refactoring.

### 3. Timeline (`/timeline`)
A chronological view of the project's history.
- **Features**:
  - **Commit Volume**: Bars showing how many commits happen per week.
  - **Churn Rate**: Line chart showing lines added/deleted.
- **Use Case**: Identify sprints, crunch periods, or periods of stagnation.

### 4. Code Ownership (`/ownership`)
Analyzes who writes the code.
- **Bus Factor**: Identifies files modified effectively by only one person.
- **Team Distribution**: Breakdown of commits by author.
- **Risk Assessment**: Highlights files that would be at risk if a key maintainer left.

### 5. Complexity Trends (`/complexity`)
Tracks technical debt over time.
- **Metric**: Cyclomatic Complexity (code branching).
- **Trend Line**: Shows if the codebase is getting harder or easier to maintain.
- **File Breakdown**: Lists files with the steepest increase in complexity.

### 6. Quality Report (`/quality`)
Static analysis for JavaScript and TypeScript.
- **Rule Engine**: SonarQube-style checks (e.g., `no-unused-vars`, `cognitive-complexity`).
- **Severity Levels**: Categorizes issues into Critical, Warning, and Info.
- **Code View**: Snippets showing exactly where the issues are.

### 7. Insights (`/insights`)
AI-driven recommendations.
- **Pattern Recognition**: Automatically detects "God Classes", "Copy-Paste", and "Coupled Modules".
- **Actionable Advice**: Suggests specific refactoring steps (e.g., "Extract Method", "Decouple").

### 8. Structural Fragility (`/fragility`)
Analysis of file coupling (Temporal Coupling).
- **Concept**: If File A and File B always change together, they are coupled.
- **Visualization**: Helper to find hidden dependencies that aren't explicit in imports.

### 9. Commit History (`/commits`)
A detailed log explorer.
- **Filter**: Search by author, date, or message.
- **Diff Stats**: See exact lines changed per commit.

---

## 🎨 UI Features

- **Glassmorphism Design**: Modern, translucent panels.
- **Responsive**: Fully functional on mobile and desktop.
- **Dark Mode**: Optimized for long coding sessions.
- **Real-time Updates**: Status chips update automatically as analysis progresses.
