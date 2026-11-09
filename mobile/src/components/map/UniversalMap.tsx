import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, Platform, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

export interface UniversalMapHandle {
  animateToCoordinate: (lat: number, lng: number, duration?: number) => void;
  animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number }, duration?: number) => void;
}

export interface UniversalMapProps {
  latitude: number;
  longitude: number;
  locality?: string;
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
  showMarker?: boolean;
  radiusKm?: number;
  style?: StyleProp<ViewStyle>;
}

export const UniversalMap = forwardRef<UniversalMapHandle, UniversalMapProps>(
  (
    {
      latitude,
      longitude,
      locality = "Location",
      onLocationSelect,
      interactive = true,
      showMarker = false,
      radiusKm,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const lastCoords = useRef({ lat: latitude, lng: longitude });
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      animateToCoordinate: (lat: number, lng: number) => {
        lastCoords.current = { lat, lng };
        webViewRef.current?.injectJavaScript(
          `if (window.updatePosition) { window.updatePosition(${lat}, ${lng}, true); } true;`
        );
      },
      animateToRegion: (region) => {
        lastCoords.current = { lat: region.latitude, lng: region.longitude };
        webViewRef.current?.injectJavaScript(
          `if (window.updatePosition) { window.updatePosition(${region.latitude}, ${region.longitude}, true); } true;`
        );
      },
    }));

    useEffect(() => {
      if (
        Math.abs(lastCoords.current.lat - latitude) > 0.0001 ||
        Math.abs(lastCoords.current.lng - longitude) > 0.0001
      ) {
        lastCoords.current = { lat: latitude, lng: longitude };
        webViewRef.current?.injectJavaScript(
          `if (window.updatePosition) { window.updatePosition(${latitude}, ${longitude}, true); } true;`
        );
      }
    }, [latitude, longitude]);

    const initialLat = latitude && !isNaN(latitude) && latitude !== 0 ? latitude : 17.385;
    const initialLng = longitude && !isNaN(longitude) && longitude !== 0 ? longitude : 78.4867;

    const leafletHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
        <style>
          * {
            -webkit-tap-highlight-color: transparent;
            box-sizing: border-box;
            user-select: none;
            -webkit-user-select: none;
          }
          body, html, #map {
            margin: 0; padding: 0; height: 100%; width: 100%;
            background-color: #EBF2EE;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .leaflet-control-attribution { display: none !important; }
          .leaflet-container {
            background-color: #EBF2EE !important;
          }

          /* Custom Pulse Pin for Bulao */
          .bulao-pin-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .bulao-pin-pulse {
            position: absolute;
            width: 44px;
            height: 44px;
            background: rgba(7, 91, 67, 0.2);
            border-radius: 50%;
            animation: bulaoPulse 2s infinite ease-out;
          }
          .bulao-pin-dot {
            width: 22px;
            height: 22px;
            background: #075B43;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(7, 91, 67, 0.45);
            z-index: 2;
          }
          @keyframes bulaoPulse {
            0% { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(1.6); opacity: 0; }
          }

          /* Modern On-Map Zoom Controls */
          .map-controls {
            position: absolute;
            right: 14px;
            bottom: ${interactive ? "95px" : "20px"};
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .map-btn {
            width: 40px;
            height: 40px;
            background: #FFFFFF;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border: 1px solid #E2E8F0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
            color: #03402D;
            cursor: pointer;
            active-background: #F1F5F9;
          }
          .map-btn:active {
            background-color: #EDFBF3;
            transform: scale(0.95);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        ${
          interactive
            ? `
          <div class="map-controls">
            <div class="map-btn" onclick="map.zoomIn()">+</div>
            <div class="map-btn" onclick="map.zoomOut()">−</div>
          </div>
        `
            : ""
        }

        <script>
          var lat = ${initialLat};
          var lng = ${initialLng};
          
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            fadeAnimation: true,
            zoomAnimation: true,
            inertia: true,
            maxZoom: 19,
            minZoom: 5
          }).setView([lat, lng], 15);

          // Fast, modern, high-contrast CartoDB Voyager tiles (CDN edge accelerated in India)
          var primaryLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map);

          // Graceful fallback to standard OpenStreetMap if Carto tile fails
          primaryLayer.on('tileerror', function() {
            if (!window._usedFallback) {
              window._usedFallback = true;
              L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
              }).addTo(map);
            }
          });

          var marker = null;
          ${
            showMarker
              ? `
            var customIcon = L.divIcon({
              className: 'bulao-pin-wrapper',
              html: '<div class="bulao-pin-pulse"></div><div class="bulao-pin-dot"></div>',
              iconSize: [44, 44],
              iconAnchor: [22, 22]
            });
            marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
          `
              : ""
          }

          ${
            radiusKm && radiusKm > 0
              ? `
            var radiusCircle = L.circle([lat, lng], {
              color: '#075B43',
              fillColor: '#075B43',
              fillOpacity: 0.14,
              weight: 2,
              radius: ${radiusKm * 1000}
            }).addTo(map);
          `
              : ""
          }

          ${
            interactive
              ? `
            map.on('click', function(e) {
              if (marker) marker.setLatLng(e.latlng);
              if (window.radiusCircle) window.radiusCircle.setLatLng(e.latlng);
              map.panTo(e.latlng, { animate: true, duration: 0.35 });
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'locationSelect',
                  latitude: e.latlng.lat,
                  longitude: e.latlng.lng
                }));
              }
            });

            var moveTimer = null;
            map.on('moveend', function() {
              clearTimeout(moveTimer);
              moveTimer = setTimeout(function() {
                var center = map.getCenter();
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapMoved',
                    latitude: center.lat,
                    longitude: center.lng
                  }));
                }
              }, 150);
            });
          `
              : `
            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
          `
          }

          window.updatePosition = function(newLat, newLng, animated) {
            if (animated) {
              map.flyTo([newLat, newLng], map.getZoom() || 15, {
                duration: 0.65,
                easeLinearity: 0.3
              });
            } else {
              map.setView([newLat, newLng], map.getZoom() || 15);
            }
            if (marker) marker.setLatLng([newLat, newLng]);
            if (window.radiusCircle) window.radiusCircle.setLatLng([newLat, newLng]);
          };

          // Notify React Native that map is ready
          setTimeout(function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
            }
          }, 200);
        </script>
      </body>
      </html>
    `;

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHtml }}
          style={styles.webView}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          overScrollMode="never"
          androidLayerType={Platform.OS === "android" ? "hardware" : "none"}
          onLoadEnd={() => setIsMapLoaded(true)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "mapReady") {
                setIsMapLoaded(true);
              } else if (
                (data.type === "locationSelect" || data.type === "mapMoved") &&
                typeof onLocationSelect === "function"
              ) {
                onLocationSelect(data.latitude, data.longitude);
              }
            } catch {
              // Ignore non-json messages
            }
          }}
        />

        {!isMapLoaded && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#075B43" />
          </View>
        )}
      </View>
    );
  }
);

UniversalMap.displayName = "UniversalMap";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#EBF2EE",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(235, 242, 238, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});
