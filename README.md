# Geolocation Line Walker PWA

This is a **Progressive Web App** that creates an interactive walking game using your device's GPS location and compass orientation. When you load the app, it creates a 5-point walking line in the direction you're facing, and tracks your progress as you walk along the path.

## 🎮 Features

- **📍 Real-time GPS Tracking**: Uses your device's precise location
- **🧭 Compass Integration**: Creates walking line based on your facing direction  
- **🗺️ Interactive Map**: Beautiful map visualization with Leaflet.js
- **📊 Progress Tracking**: Shows completion percentage and distance to path
- **📱 PWA Installable**: Can be installed as a native app on mobile devices
- **🔄 Offline Support**: Works without internet after initial load
- **🎯 Demo Mode**: Test functionality without GPS (local development)

## 🚀 How It Works

1. **Grant Permissions**: Allow location access and device orientation
2. **Line Generation**: App creates 5 numbered waypoints, each 1 meter apart
3. **Start Walking**: Follow the path to complete the line
4. **Track Progress**: Green line shows your progress along the path
5. **Real-time Feedback**: Get distance and completion percentage updates

## 🔧 GitHub Pages Deployment

This app is configured to work seamlessly on GitHub Pages. The code automatically detects the deployment environment and adjusts paths accordingly.

### Quick Deploy Steps:

1. **Fork this repository** or create a new one with this code
2. **Update the repository name** in the configuration (see below)
3. **Enable GitHub Pages** in repository settings
4. **Access your app** at `https://yourusername.github.io/your-repo-name/`

### Changing Repository Configuration

If your repository name is different from `github-page-pwa-poc`, update these files:

#### 1. Update `index.html`
```html
<!-- Change the canonical URL -->
<link rel="canonical" href="https://yourusername.github.io/your-repo-name/" />

<!-- Update service worker registration -->
const swPath = isLocal ? './sw.js' : '/your-repo-name/sw.js';
const scope = isLocal ? './' : '/your-repo-name/';
```

#### 2. Update `sw.js`
```javascript
// Change this to your repository name
var GHPATH = isLocal ? '' : '/your-repo-name';
```

### Original Template Information

This PWA is built on the GitHub Pages PWA template. The original template instructions remain valid for understanding the PWA deployment mechanics:

## Changing the index.html

The first thing you need to do change is the `index.html` document. You need two things for this. Your GitHub username, for example in this case `mszawerda` and the name of the repository you host as a GitHub Page, in this case `github-page-pwa-poc`.

The current `index.html` has these settings already, and you need to change them accordingly.

In the following example, each `mszawerda` needs to become yours and `github-page-pwa-poc` the name of your repository. Make sure to not remove any `/`, as they are crucial for this to work.

## Changing the service worker to make your site available offline

The `sw.js` file is the ServiceWorker that defines which of the files in your application should become available offline. The app automatically detects whether it's running locally or on GitHub Pages and configures paths accordingly.

```javascript
// The app automatically handles this:
var GHPATH = isLocal ? '' : '/github-page-pwa-poc';
var APP_PREFIX = 'glw_';
var VERSION = 'version_002';

// Files cached for offline use
var URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/css/styles.css`,
  `${GHPATH}/js/app.js`,
  `${GHPATH}/img/icon.png`,
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
]
```

## Changing the manifest to make your app installable

The `manifest.webmanifest` file defines the app name, icons, and installation behavior. The current configuration uses relative paths that work in both local development and GitHub Pages deployment.

```json
{
  "name": "Geolocation Line Walker PWA",
  "short_name": "LineWalker",
  "description": "A Progressive Web App that creates a walking line based on your location and orientation",
  "scope": "./",
  "start_url": "./",
  "background_color": "#2c3e50",
  "theme_color": "#3498db",
  "display": "standalone",
  "icons": [
    {
      "src": "img/icon.png",
      "type": "image/png",
      "sizes": "700x700"
    }
  ]
}
```

## 🎯 Local Development

For local testing:
1. Serve the files with a local web server
2. Use the **Demo Mode** button to test without GPS
3. Or use HTTPS locally for full geolocation features

## 🔒 Security Requirements

- **HTTPS Required**: Geolocation APIs require HTTPS (automatically provided by GitHub Pages)
- **Permissions**: App requests location and device orientation permissions
- **Privacy**: Location data is used only locally, never transmitted to servers

## 📱 Mobile Experience

The app is optimized for mobile devices with:
- Touch-friendly interface
- Responsive design
- Native app installation capability
- GPS and compass integration
- Offline functionality

Enjoy creating your walking adventures! 🚶‍♀️🗺️
