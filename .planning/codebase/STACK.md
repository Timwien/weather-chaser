# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- JavaScript (ES6+) - Application logic and interactivity
- HTML5 - Page structure
- CSS3 - Styling and responsive layout

## Runtime

**Environment:**
- Browser runtime (client-side only)
- No Node.js or backend server required

**Package Manager:**
- None - Static application with CDN-hosted libraries

## Frameworks

**Core:**
- Vanilla JavaScript - No framework dependencies for core application logic

**Mapping:**
- Leaflet.js 1.9.4 - Interactive map visualization
  - CDN: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
  - CSS: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`

**Map Drawing:**
- Leaflet Draw 1.0.4 - Polygon and rectangle drawing on map
  - CDN: `https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js`
  - CSS: `https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css`

## Key Dependencies

**Critical:**
- Leaflet.js - Map rendering and interaction (loaded from CDN)
- Leaflet Draw - Drawing tools for area selection (loaded from CDN)

## Configuration

**Environment:**
- No environment configuration required
- No API keys needed - all external APIs are free and public

**Build:**
- No build process - Static HTML/CSS/JS application
- Works directly in browser by opening `index.html`

## Platform Requirements

**Development:**
- Any modern text editor for source code editing
- Any modern web browser for testing and running

**Production:**
- Static file hosting service capable of serving HTML/CSS/JS
- Browser support:
  - Chrome/Edge (recommended)
  - Firefox
  - Safari
  - Mobile browsers (iOS Safari, Chrome Mobile)

**Deployment Targets:**
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service
- Local filesystem (file:// protocol)

## Resource Files

**HTML:**
- `index.html` - Main application structure and layout

**CSS:**
- `style.css` - Responsive styling with CSS custom properties (variables) for theming
- Color scheme defined in `:root` CSS variables:
  - Primary: `#6366f1` (indigo)
  - Success: `#10b981` (green - excellent weather)
  - Warning: `#f59e0b` (orange - fair weather)
  - Danger: `#ef4444` (red - poor weather)

**JavaScript:**
- `app.js` - Complete application logic (1562 lines)
  - Main class: `WeatherChaser`
  - Handles all user interactions, API calls, and data processing
  - Global initialization on DOM loaded

## Fonts

**System Fonts (Web-safe):**
- `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`
- No custom fonts or typography libraries

## Browser APIs Used

**Native Web APIs:**
- Fetch API - HTTP requests to external APIs
- DOM APIs - Element manipulation and event listeners
- LocalStorage - Not currently detected in use
- Geolocation - Not currently implemented
- SVG - Embedded data URIs for decorative elements

---

*Stack analysis: 2026-02-25*
