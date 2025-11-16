# ☀️ Weather Chaser

**Find the best weather spots for your next adventure!**

Weather Chaser is a static web application designed for travelers, van lifers, and adventure seekers who want to find the best weather conditions near their location.

## Features

- 🌍 **Flexible Location Input**: Enter a city, postal code, coordinates, or use the map
- 📍 **Customizable Search Radius**: Search from 10km to 500km around your location
- 📅 **Forecast Range**: View weather up to 14 days in advance
- 🗺️ **Interactive Map**: Visualize weather spots with color-coded markers
- 📊 **Sortable Table**: Compare locations by score, temperature, sun hours, rain chance, and wind
- 🎯 **Smart Scoring Algorithm**: Prioritizes low rain probability, high sun hours, comfortable temperatures, and low wind
- 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices
- 🆓 **No API Key Required**: Uses free Open-Meteo weather API

## How It Works

### 1. Location Search
Enter your starting location in any of these formats:
- City name: `Berlin`
- Postal code: `10115`
- Coordinates: `52.52,13.405`

### 2. Grid Generation
The app creates a grid of points around your location based on:
- **Search Radius**: How far from your location to search (in kilometers)
- **Grid Points**: Number of locations to analyze (9, 16, 25, 36, or 49 points)

### 3. Weather Analysis
For each grid point, the app fetches a weather forecast and calculates:
- Average temperature
- Sun hours per day
- Rain probability
- Maximum wind speed

### 4. Weather Score Calculation
Each location receives a score (0-100) based on weighted factors:
- **Rain Chance**: 40% weight (less rain = higher score)
- **Sun Hours**: 30% weight (more sun = higher score)
- **Temperature**: 20% weight (optimum: 20-25°C)
- **Wind Speed**: 10% weight (less wind = higher score)

### 5. Results Display
Results are shown in two ways:
- **Map View**: Color-coded markers (green = excellent, blue = good, orange = fair, red = poor)
- **Table View**: Sortable data with all weather metrics

## Usage

### Opening the App
Simply open `index.html` in a modern web browser. No build process or server required!

### Example Searches
1. **City Search**:
   - Location: `Paris`
   - Radius: 100 km
   - Days: 7
   - Grid: 25 points

2. **Coordinates Search**:
   - Location: `48.8566,2.3522`
   - Radius: 200 km
   - Days: 3
   - Grid: 16 points

3. **Postal Code Search**:
   - Location: `75001`
   - Radius: 150 km
   - Days: 14
   - Grid: 36 points

## Technologies Used

- **HTML5/CSS3/JavaScript**: Core web technologies
- **Leaflet.js**: Interactive map visualization
- **Open-Meteo API**: Free weather forecast data
- **Nominatim API**: Free geocoding service (OpenStreetMap)

## Project Structure

```
weather-chaser/
├── index.html          # Main HTML structure
├── style.css           # Responsive styles and theming
├── app.js              # Application logic and API integration
└── README.md           # This file
```

## API Information

### Open-Meteo API
- **URL**: https://open-meteo.com/
- **Free**: Yes, no API key required
- **Rate Limits**: Generous for personal use
- **Data**: Temperature, precipitation, sunshine, wind speed

### Nominatim API
- **URL**: https://nominatim.openstreetmap.org/
- **Free**: Yes, no API key required
- **Usage Policy**: Please use responsibly (max 1 request/second)
- **Purpose**: Convert addresses to coordinates

## Browser Compatibility

- Chrome/Edge: ✅ (recommended)
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## Deployment

This is a static website and can be deployed to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service
- Or simply open `index.html` locally

### GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Select branch and root folder
4. Your site will be available at `https://yourusername.github.io/weather-chaser/`

## Customization

### Adjusting Weather Score Weights
Edit `app.js`, function `calculateScores()`:

```javascript
const totalScore = (
    rainScore * 0.40 +    // Rain weight
    sunScore * 0.30 +     // Sun weight
    tempScore * 0.20 +    // Temperature weight
    windScore * 0.10      // Wind weight
);
```

### Changing Temperature Preferences
Edit `app.js`, function `calculateTempScore()`:

```javascript
const optimal = 22.5;  // Change optimal temperature
```

### Color Scheme
Edit `style.css`, `:root` section:

```css
:root {
    --primary-color: #3b82f6;    /* Main theme color */
    --success-color: #10b981;    /* Excellent weather */
    --warning-color: #f59e0b;    /* Fair weather */
    --danger-color: #ef4444;     /* Poor weather */
}
```

## Performance Tips

- Use smaller grid sizes (9 or 16) for faster searches
- Reduce forecast days for quicker results
- Smaller search radius = faster API calls

## Limitations

- Weather forecast accuracy decreases beyond 7 days
- Geocoding may not find very specific addresses
- Maximum 14-day forecast (API limitation)
- Grid points are evenly distributed (doesn't account for water bodies or restricted areas)

## Future Enhancements

Potential features to add:
- [ ] Drawing custom search areas on the map
- [ ] Save favorite locations
- [ ] Weather alerts and notifications
- [ ] More detailed weather metrics (humidity, UV index, etc.)
- [ ] Export results to CSV/PDF
- [ ] Dark mode toggle
- [ ] Multi-language support

## License

This project is open source and available under the MIT License.

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Geocoding: [Nominatim](https://nominatim.openstreetmap.org/)
- Maps: [OpenStreetMap](https://www.openstreetmap.org/)
- Map library: [Leaflet](https://leafletjs.com/)

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Happy weather chasing!** 🌤️
