<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Bun-Runtime-F9F1E1?style=for-the-badge&logo=bun" alt="Bun" />
</p>

<h1 align="center">🏛️ Code Archaeology</h1>

<p align="center">
  <strong>Uncover the hidden history of your codebase</strong>
</p>

<p align="center">
  A beautiful, modern dashboard that reveals patterns in your repository's evolution.<br/>
  Track hotspots, ownership, complexity trends, and technical debt with stunning visualizations.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📊 Dashboard Overview
Real-time metrics showing delivery tempo, change load, and risk index at a glance.

### 🔥 Hotspot Analysis  
Interactive treemap revealing where code changes concentrate most frequently.

### 📈 Timeline Charts
Beautiful D3.js visualizations of commit activity and code churn over time.

</td>
<td width="50%">

### 👥 Ownership Tracking
Understand who owns what code and identify bus factor risks before they become problems.

### 📉 Complexity Trends
Track cyclomatic complexity evolution and spot technical debt accumulation.

### 💡 AI Insights
Automated recommendations powered by pattern analysis across your codebase.

</td>
</tr>
</table>

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/sanketpatel32/code-archaeology-frontend.git

# Navigate to project
cd code-archaeology-frontend

# Install dependencies
bun install

# Set up environment
cp .env.example .env.local

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Custom CSS (no Tailwind) |
| **Charts** | D3.js + Recharts |
| **State** | TanStack Query |
| **Runtime** | Bun |

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard pages
│   │   ├── page.tsx        # Overview
│   │   ├── hotspots/       # Hotspot analysis
│   │   ├── timeline/       # Activity timeline
│   │   ├── ownership/      # Code ownership
│   │   ├── complexity/     # Complexity trends
│   │   ├── quality/        # Code quality
│   │   └── insights/       # AI recommendations
│   └── layout.tsx
├── components/
│   ├── charts/             # D3 & Recharts
│   └── layout/             # Navigation
└── lib/
    ├── api.ts              # API client
    └── hooks/              # Custom hooks
```

## 📱 Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard with key metrics |
| `/hotspots` | File hotspot treemap |
| `/timeline` | Commit activity charts |
| `/ownership` | Team contributions |
| `/complexity` | Complexity trends |
| `/quality` | Code quality report |
| `/insights` | AI recommendations |
| `/fragility` | File coupling |
| `/commits` | Commit history |

## 🐳 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sanketpatel32/code-archaeology-frontend)

1. Import repository to Vercel
2. Add environment variable: `NEXT_PUBLIC_API_URL`
3. Deploy!

### Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.com \
  -t code-archaeology-frontend .
```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run start` | Start production |
| `bun run lint` | Run ESLint |

## 🎨 Design

- **Theme**: Dark mode with glassmorphism
- **Typography**: Inter font family
- **Animations**: Smooth micro-interactions
- **Colors**: Consistent palette across charts

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/sanketpatel32">Sanket Patel</a>
</p>

<p align="center">
  <a href="https://github.com/sanketpatel32/code-archaeology-frontend/stargazers">⭐ Star this repo</a> •
  <a href="https://github.com/sanketpatel32/code-archaeology-frontend/issues">🐛 Report Bug</a> •
  <a href="https://github.com/sanketpatel32/code-archaeology-frontend/issues">💡 Request Feature</a>
</p>
