# 🏛️ Code Archaeology - Frontend

A modern, beautiful dashboard for visualizing your repository's hidden history. Built with Next.js 15 and React 19, featuring stunning data visualizations and real-time analysis updates.

## ✨ Features

- **📊 Interactive Dashboard** - Beautiful overview of repository health
- **🔥 Hotspot Treemap** - Visual representation of code change concentration
- **📈 Timeline Charts** - Commit activity and churn trends over time
- **👥 Ownership Analysis** - Team contribution breakdown and bus factor
- **📉 Complexity Trends** - Track technical debt evolution
- **💡 AI Insights** - Automated recommendations for code health
- **🎨 Dark Mode** - Stunning glassmorphism design

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) with App Router
- **UI**: React 19 with Tailwind-free custom CSS
- **Charts**: D3.js + Recharts for data visualization
- **State**: TanStack Query for server state
- **Runtime**: [Bun](https://bun.sh) for fast development

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+ or Node.js 18+
- Running backend API

### Installation

```bash
# Clone the repository
git clone https://github.com/sanketpatel32/code-archaeology-frontend.git
cd code-archaeology-frontend

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API URL
```

### Environment Variables

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# For production (example)
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Running Locally

```bash
# Start development server
bun run dev

# Open http://localhost:3000
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |

## 📁 Project Structure

```
client/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (dashboard)/     # Dashboard routes
│   │   │   ├── page.tsx           # Overview
│   │   │   ├── hotspots/          # Hotspot analysis
│   │   │   ├── timeline/          # Activity timeline
│   │   │   ├── ownership/         # Code ownership
│   │   │   ├── complexity/        # Complexity trends
│   │   │   ├── quality/           # Code quality
│   │   │   └── insights/          # AI recommendations
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── charts/          # D3 & Recharts components
│   │   ├── layout/          # Navigation, sidebar
│   │   └── ui/              # Reusable UI components
│   └── lib/
│       ├── api.ts           # API client
│       ├── format.ts        # Formatting utilities
│       └── hooks/           # Custom React hooks
├── public/                  # Static assets
├── Dockerfile              # Production container
└── next.config.ts          # Next.js configuration
```

## 📱 Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview with key metrics |
| `/hotspots` | File hotspot analysis with treemap |
| `/timeline` | Commit activity over time |
| `/ownership` | Code ownership and bus factor |
| `/complexity` | Cyclomatic complexity trends |
| `/quality` | Code quality report (JS/TS) |
| `/insights` | AI-powered recommendations |
| `/fragility` | File coupling analysis |
| `/commits` | Detailed commit history |

## 🐳 Docker Deployment

### Build Image

```bash
# Build with API URL
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.com \
  -t code-archaeology-frontend .
```

### Deploy to Vercel

1. Import repository to Vercel
2. Add environment variable: `NEXT_PUBLIC_API_URL`
3. Deploy automatically on push

### Vercel Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Build Command | `bun run build` |
| Output Directory | `.next` (auto-detected) |
| Install Command | `bun install` |

## 🎨 Design System

The app uses a custom design system with:

- **Colors**: CSS custom properties for theming
- **Typography**: Inter font family
- **Components**: Glassmorphism panels, animated transitions
- **Charts**: Consistent color palette across visualizations

## 🔧 Configuration

### Next.js Config

```typescript
// next.config.ts
const nextConfig = {
  output: "standalone",  // Optimized for Docker
  reactCompiler: true,   // React 19 compiler
};
```

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

---

Built with ❤️ by [Sanket Patel](https://github.com/sanketpatel32)
