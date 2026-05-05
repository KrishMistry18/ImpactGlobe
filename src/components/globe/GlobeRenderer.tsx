"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { latLonToVector3, sunPosition } from "@/lib/geo/coordinates";
import { IMPACT_COLORS, RIPPLE_CONFIG, easeInOut } from "./ripple.utils";
import {
  createHeatmapTexture,
  findNearestWindPoint,
  findNearestTempPoint,
  findNearestAQIPoint,
  findNearestSeaTempPoint,
} from "./heatmap.utils";
import type { GlobeEvent, ScreenPosition } from "@/store/types";
import type { HoveredEnvPoint } from "@/store/useGlobeStore";

// ─── Public ref interface ────────────────────────────────────────────────
export interface GlobeRef {
  flyTo: (lat: number, lon: number) => void;
}

// ─── Props ───────────────────────────────────────────────────────────────
interface GlobeRendererProps {
  events: GlobeEvent[];
  onEventClick: (event: GlobeEvent) => void;
  onEventHover: (event: GlobeEvent | null) => void;
  onEnvHover: (
    point: HoveredEnvPoint | null,
    screenPos?: { x: number; y: number },
  ) => void;
  hoveredEventScreenPos: React.MutableRefObject<Map<string, ScreenPosition>>;
  activeEnvLayer: import("@/store/types").EnvLayerType;
  envLayerData: import("@/store/types").EnvLayerData | null;
}

// ─── GeoJSON types ───────────────────────────────────────────────────────
interface GeoJsonGeometry {
  type: string;
  coordinates: number[][][] | number[][][][];
}
interface GeoJsonFeature {
  type: string;
  properties: { NAME?: string; ADMIN?: string; [key: string]: unknown };
  geometry: GeoJsonGeometry;
}
interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

// ─── Constants ───────────────────────────────────────────────────────────
const GLOBE_RADIUS = 1.0;
const CAMERA_DISTANCE = 2.8 * GLOBE_RADIUS;
const CAMERA_MIN = 1.5;
const CAMERA_MAX = 4.0;
const FLY_TO_DURATION = 1200;
const STAR_COUNT = 2000;
const STAR_RADIUS = 300;
const AUTO_ROTATE_RESUME_MS = 4000;
const SUN_UPDATE_INTERVAL_MS = 60_000;

const EARTH_DAY_URL =
  "https://unpkg.com/three-globe/example/img/earth-day.jpg";
const EARTH_NIGHT_URL =
  "https://unpkg.com/three-globe/example/img/earth-night.jpg";
const COUNTRY_BORDERS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

// ─── Ripple marker internal type ─────────────────────────────────────────
interface RippleMarker {
  eventId: string;
  group: THREE.Group;
  rings: THREE.Mesh[];
  coreDot: THREE.Mesh;
  impactLevel: GlobeEvent["impactLevel"];
}

// ─── Component ───────────────────────────────────────────────────────────
const GlobeRenderer = forwardRef<GlobeRef, GlobeRendererProps>(
  function GlobeRenderer(
    {
      events,
      onEventClick,
      onEventHover,
      onEnvHover,
      hoveredEventScreenPos,
      activeEnvLayer,
      envLayerData,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Three.js core refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const frameIdRef = useRef<number>(0);

    // Scene object refs
    const markersGroupRef = useRef<THREE.Group | null>(null);
    const rippleMarkersRef = useRef<RippleMarker[]>([]);
    const hitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const earthMeshRef = useRef<THREE.Mesh | null>(null);
    const heatmapTextureRef = useRef<THREE.CanvasTexture | null>(null);
    const heatmapMeshRef = useRef<THREE.Mesh | null>(null);

    // Interaction refs
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2(-999, -999));
    const autoRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const sunIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
    // Sun direction uniform — shared with the earth ShaderMaterial
    const sunUniformRef = useRef<{ value: THREE.Vector3 }>({ value: new THREE.Vector3(1, 0, 0) });

    // FlyTo animation ref
    const flyToAnimRef = useRef<{
      startTime: number;
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
    } | null>(null);

    // Track events for hover/click callbacks via ref (avoids stale closures)
    const eventsRef = useRef<GlobeEvent[]>(events);
    eventsRef.current = events;
    const onEventClickRef = useRef(onEventClick);
    onEventClickRef.current = onEventClick;
    const onEventHoverRef = useRef(onEventHover);
    onEventHoverRef.current = onEventHover;
    const onEnvHoverRef = useRef(onEnvHover);
    onEnvHoverRef.current = onEnvHover;

    // Refs for active env layer + data (avoids stale closures in animation loop)
    const activeEnvLayerRef = useRef(activeEnvLayer);
    activeEnvLayerRef.current = activeEnvLayer;
    const envLayerDataRef = useRef(envLayerData);
    envLayerDataRef.current = envLayerData;

    // Previous events for diffing
    const prevEventsRef = useRef<GlobeEvent[]>([]);

    // ─── Create starfield ────────────────────────────────────────────────
    const createStarfield = useCallback((): THREE.Points => {
      const positions = new Float32Array(STAR_COUNT * 3);
      for (let i = 0; i < STAR_COUNT; i++) {
        // Uniform distribution on sphere surface
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = STAR_RADIUS * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = STAR_RADIUS * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = STAR_RADIUS * Math.cos(phi);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: true,
      });
      return new THREE.Points(geometry, material);
    }, []);

    // ─── Create earth sphere (day texture, reliable Phong lighting) ────────
    const createEarth = useCallback((): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0x112040),
        shininess: 8,
        specular: new THREE.Color(0x1a3a6e),
      });
      const loader = new THREE.TextureLoader();
      loader.load(EARTH_DAY_URL, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      });
      return new THREE.Mesh(geometry, material);
    }, []);

    // ─── City lights — night-only shader ──────────────────────────────────
    // nightFactor=1 on dark side, 0 on day side — discard keeps day perfectly clean
    const createCityLights = useCallback((): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, 64, 64);
      const nightTex: { value: THREE.Texture | null } = { value: null };
      const material = new THREE.ShaderMaterial({
        uniforms: {
          nightTexture: nightTex,
          sunDirection: sunUniformRef.current,
        },
        vertexShader: /* glsl */`
          varying vec3 vWorldNormal;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D nightTexture;
          uniform vec3 sunDirection;
          varying vec3 vWorldNormal;
          varying vec2 vUv;
          void main() {
            float cosAngle = dot(vWorldNormal, normalize(sunDirection));
            // nightFactor: 1.0 = full night, 0.0 = full day
            float nightFactor = smoothstep(0.20, -0.20, cosAngle);
            if (nightFactor <= 0.01) discard;
            vec4 city = texture2D(nightTexture, vUv);
            // Amplify 3.5x and tint warm golden (street light color)
            vec3 warm = vec3(
              city.r * 1.15,   // boost red for warm gold
              city.g * 0.95,   // slight green
              city.b * 0.55    // cut blue — street lights are not blue
            ) * 3.5;
            gl_FragColor = vec4(warm * nightFactor, nightFactor);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const loader = new THREE.TextureLoader();
      loader.load(EARTH_NIGHT_URL, (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        nightTex.value = t; material.needsUpdate = true;
      });
      return new THREE.Mesh(geometry, material);
    }, []);

    // ─── Create atmosphere halo ──────────────────────────────────────────
    const createAtmosphere = useCallback((): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.15, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
        depthWrite: false,
      });
      return new THREE.Mesh(geometry, material);
    }, []);

    // ─── Load country borders (borders only, no labels) ──────────────────
    const loadCountryBorders = useCallback((scene: THREE.Scene) => {
      fetch(COUNTRY_BORDERS_URL)
        .then((res) => res.json())
        .then((geojson: GeoJsonCollection) => {
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x334466,
            transparent: true,
            opacity: 0.4,
          });
          const bordersGroup = new THREE.Group();
          for (const feature of geojson.features) {
            const { geometry } = feature;
            const rings: number[][][] =
              geometry.type === "Polygon"
                ? (geometry.coordinates as number[][][])
                : geometry.type === "MultiPolygon"
                  ? (geometry.coordinates as number[][][][]).flat()
                  : [];
            for (const ring of rings) {
              if (ring.length < 2) continue;
              const points: THREE.Vector3[] = [];
              for (const coord of ring) {
                points.push(latLonToVector3(coord[1], coord[0], GLOBE_RADIUS * 1.001));
              }
              bordersGroup.add(new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints(points), lineMaterial
              ));
            }
          }
          scene.add(bordersGroup);
        })
        .catch((err) => console.warn("Failed to load country borders:", err));
    }, []);

    // ─── Create ripple marker for event ──────────────────────────────────
    const createRippleMarker = useCallback(
      (event: GlobeEvent): RippleMarker => {
        const group = new THREE.Group();
        const color = IMPACT_COLORS[event.impactLevel];
        const config = RIPPLE_CONFIG[event.impactLevel];
        const position = latLonToVector3(
          event.lat,
          event.lon,
          GLOBE_RADIUS + 0.005,
        );

        const rings: THREE.Mesh[] = [];

        // Create 3 rings with phase offsets at 0%, 33%, 66%
        for (let i = 0; i < config.ringCount; i++) {
          const ringGeo = new THREE.RingGeometry(0.0, 0.05, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          rings.push(ring);
          group.add(ring);
        }

        // Core dot (small sphere)
        const dotGeo = new THREE.SphereGeometry(config.coreRadius, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.9,
        });
        const coreDot = new THREE.Mesh(dotGeo, dotMat);
        group.add(coreDot);

        // Position and orient the group to face outward from globe surface
        group.position.copy(position);
        group.lookAt(group.position.clone().multiplyScalar(2));

        return {
          eventId: event.id,
          group,
          rings,
          coreDot,
          impactLevel: event.impactLevel,
        };
      },
      [],
    );

    // ─── Animate ripples each frame ──────────────────────────────────────
    const animateRipples = useCallback((time: number) => {
      for (const marker of rippleMarkersRef.current) {
        const config = RIPPLE_CONFIG[marker.impactLevel];

        for (let i = 0; i < marker.rings.length; i++) {
          // Phase offsets: ring 0 = 0%, ring 1 = 33%, ring 2 = 66%
          const phaseOffset = (i / config.ringCount) * config.duration;
          const progress =
            ((time + phaseOffset) % config.duration) / config.duration; // 0 → 1
          const scale = progress * config.maxScale;
          const opacity = 1.0 - progress;

          marker.rings[i].scale.setScalar(scale || 0.001); // Avoid zero scale
          const mat = marker.rings[i].material as THREE.MeshBasicMaterial;
          mat.opacity = opacity * 0.85;
        }

        // Core dot pulse
        const pulseScale = 0.9 + 0.2 * Math.sin(time * 0.003);
        marker.coreDot.scale.setScalar(pulseScale);
      }
    }, []);

    // ─── Sync events to markers (diff-based) ─────────────────────────────
    const syncEventMarkers = useCallback(
      (eventsList: GlobeEvent[]) => {
        const markersGroup = markersGroupRef.current;
        if (!markersGroup) return;

        const prevIds = new Set(prevEventsRef.current.map((e) => e.id));
        const newIds = new Set(eventsList.map((e) => e.id));

        // Remove stale markers
        rippleMarkersRef.current = rippleMarkersRef.current.filter((m) => {
          if (!newIds.has(m.eventId)) {
            markersGroup.remove(m.group);
            m.rings.forEach((r) => {
              r.geometry.dispose();
              (r.material as THREE.Material).dispose();
            });
            m.coreDot.geometry.dispose();
            (m.coreDot.material as THREE.Material).dispose();

            // Remove hit mesh
            const hitMesh = hitMeshesRef.current.get(m.eventId);
            if (hitMesh) {
              markersGroup.remove(hitMesh);
              hitMesh.geometry.dispose();
              (hitMesh.material as THREE.Material).dispose();
              hitMeshesRef.current.delete(m.eventId);
            }
            return false;
          }
          return true;
        });

        // Add new markers
        for (const event of eventsList) {
          if (!prevIds.has(event.id)) {
            const marker = createRippleMarker(event);
            markersGroup.add(marker.group);
            rippleMarkersRef.current.push(marker);

            // Invisible hit sphere for raycasting
            const hitGeo = new THREE.SphereGeometry(0.07, 8, 8);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.copy(
              latLonToVector3(event.lat, event.lon, GLOBE_RADIUS * 1.05),
            );
            hitMesh.userData = { eventId: event.id };
            markersGroup.add(hitMesh);
            hitMeshesRef.current.set(event.id, hitMesh);
          }
        }

        prevEventsRef.current = eventsList;
      },
      [createRippleMarker],
    );

    // ─── Handle mouse move ───────────────────────────────────────────────
    const handleMouseMove = useCallback((e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }, []);

    // ─── Handle click ────────────────────────────────────────────────────
    const handleClick = useCallback((e: MouseEvent) => {
      const camera = cameraRef.current;
      if (!camera) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycasterRef.current.setFromCamera(mouse, camera);
      const hitMeshes = Array.from(hitMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(
        hitMeshes,
        false,
      );

      if (intersects.length > 0) {
        const eventId = intersects[0].object.userData?.eventId;
        if (eventId) {
          const event = eventsRef.current.find((ev) => ev.id === eventId);
          if (event) onEventClickRef.current(event);
        }
      }
    }, []);

    // ─── Hover raycast (called in animation loop) ────────────────────────
    const performHoverRaycast = useCallback(() => {
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!camera || !container) return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // ── Heatmap layer: raycast against the earth sphere for lat/lon lookup ──
      const currentLayer = activeEnvLayerRef.current;
      const isHeatmapLayer = [
        "wind",
        "temperature_anomaly",
        "aqi",
        "sea_temp",
      ].includes(currentLayer);

      if (isHeatmapLayer) {
        const earth = earthMeshRef.current;
        if (earth) {
          const hits = raycasterRef.current.intersectObject(earth, false);
          if (hits.length > 0) {
            let hitLat = 0,
              hitLon = 0;
            const uv = hits[0].uv;
            if (uv) {
              // Three.js SphereGeometry UV: u=0→1 maps lon -180→180, v=0→1 maps lat -90→90
              hitLon = uv.x * 360 - 180;
              hitLat = uv.y * 180 - 90;
            } else {
              const point = hits[0].point.clone().normalize();
              hitLon = Math.atan2(point.z, point.x) * (180 / Math.PI);
              hitLat =
                Math.asin(Math.max(-1, Math.min(1, point.y))) * (180 / Math.PI);
            }

            const layerData = envLayerDataRef.current;
            let envPoint: HoveredEnvPoint | null = null;

            if (currentLayer === "wind" && layerData?.wind?.length) {
              const p = findNearestWindPoint(layerData.wind, hitLat, hitLon);
              if (p)
                envPoint = {
                  type: "wind",
                  lat: hitLat,
                  lon: hitLon,
                  speed: p.speed,
                  direction: p.direction,
                };
            } else if (
              currentLayer === "temperature_anomaly" &&
              layerData?.tempAnomalies?.length
            ) {
              const p = findNearestTempPoint(
                layerData.tempAnomalies,
                hitLat,
                hitLon,
              );
              if (p)
                envPoint = {
                  type: "temperature",
                  lat: hitLat,
                  lon: hitLon,
                  tempC: p.anomalyC,
                };
            } else if (currentLayer === "aqi" && layerData?.aqi?.length) {
              const p = findNearestAQIPoint(layerData.aqi, hitLat, hitLon);
              if (p)
                envPoint = {
                  type: "aqi",
                  lat: hitLat,
                  lon: hitLon,
                  aqi: p.aqi,
                  pm25: p.pm25,
                  category: p.category,
                };
            } else if (
              currentLayer === "sea_temp" &&
              layerData?.seaTemp?.length
            ) {
              const p = findNearestSeaTempPoint(
                layerData.seaTemp,
                hitLat,
                hitLon,
              );
              if (p)
                envPoint = {
                  type: "sea_temp",
                  lat: hitLat,
                  lon: hitLon,
                  tempC: p.tempC,
                };
            }

            if (envPoint) {
              container.style.cursor = "crosshair";
              const rect = container.getBoundingClientRect();
              const sx = ((mouseRef.current.x + 1) / 2) * rect.width;
              const sy = ((-mouseRef.current.y + 1) / 2) * rect.height;
              onEnvHoverRef.current(envPoint, { x: sx, y: sy });
              return;
            }
          }
        }
        onEnvHoverRef.current(null);
        container.style.cursor = "";
        return;
      }

      // ── Discrete event markers ──
      const hitMeshes = Array.from(hitMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(
        hitMeshes,
        false,
      );

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const eventId = hit.userData?.eventId;
        if (eventId) {
          const event = eventsRef.current.find((ev) => ev.id === eventId);
          if (event) {
            container.style.cursor = "pointer";
            onEventHoverRef.current(event);

            const worldPos = new THREE.Vector3();
            hit.getWorldPosition(worldPos);
            const projected = worldPos.clone().project(camera);
            const rect = container.getBoundingClientRect();
            const x = ((projected.x + 1) / 2) * rect.width;
            const y = ((-projected.y + 1) / 2) * rect.height;
            hoveredEventScreenPos.current.set(eventId, { x, y });
            return;
          }
        }
      }

      // No hit — reset
      onEventHoverRef.current(null);
      onEnvHoverRef.current(null);
      container.style.cursor = "";
    }, [hoveredEventScreenPos]);

    // ─── INITIALIZATION ──────────────────────────────────────────────────
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // ── Scene ──
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050a14);
      sceneRef.current = scene;

      // ── Camera ──
      const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 0, CAMERA_DISTANCE);
      cameraRef.current = camera;

      // ── Renderer ──
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── OrbitControls ──
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.enableZoom = true;
      controls.minDistance = CAMERA_MIN;
      controls.maxDistance = CAMERA_MAX;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      controlsRef.current = controls;

      // Track interaction: stop auto-rotate immediately on start,
      // resume after 4 seconds of inactivity
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        if (autoRotateTimerRef.current) {
          clearTimeout(autoRotateTimerRef.current);
          autoRotateTimerRef.current = null;
        }
      });
      controls.addEventListener("end", () => {
        if (autoRotateTimerRef.current) {
          clearTimeout(autoRotateTimerRef.current);
        }
        autoRotateTimerRef.current = setTimeout(() => {
          controls.autoRotate = true;
        }, AUTO_ROTATE_RESUME_MS);
      });

      // ── Lighting ──
      // Near-zero ambient — space has no ambient light, only sun illumination
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
      scene.add(ambientLight);

      // Directional "sun" light — only illuminates the day side
      const sun = sunPosition(new Date());
      const sunPos = latLonToVector3(sun.lat, sun.lon, 50);
      // Initialize shader sun direction uniform
      sunUniformRef.current.value.copy(sunPos.clone().normalize());
      const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.1);
      dirLight.position.copy(sunPos);
      scene.add(dirLight);
      dirLightRef.current = dirLight;

      // Update sun position + shader uniform every 60 seconds
      sunIntervalRef.current = setInterval(() => {
        const newSun = sunPosition(new Date());
        const newSunPos = latLonToVector3(newSun.lat, newSun.lon, 50);
        dirLight.position.copy(newSunPos);
        sunUniformRef.current.value.copy(newSunPos.clone().normalize());
      }, SUN_UPDATE_INTERVAL_MS);

      // ── Star field ──
      const stars = createStarfield();
      scene.add(stars);

      // ── Earth sphere ──
      const earth = createEarth();
      scene.add(earth);
      earthMeshRef.current = earth;

      // ── City lights (night-only shader — golden glow on dark side only) ──
      scene.add(createCityLights());

      // ── Atmosphere halo ──
      const atmosphere = createAtmosphere();
      scene.add(atmosphere);

      // ── Heatmap overlay sphere ──
      const heatmapGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, 64, 64);
      const heatmapMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      const heatmapMesh = new THREE.Mesh(heatmapGeo, heatmapMat);
      scene.add(heatmapMesh);
      heatmapMeshRef.current = heatmapMesh;

      // ── Country borders ──
      loadCountryBorders(scene);

      // ── Markers group ──
      const markersGroup = new THREE.Group();
      scene.add(markersGroup);
      markersGroupRef.current = markersGroup;

      // ── Event listeners ──
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("click", handleClick);

      // ── Resize observer ──
      const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(container);

      // ── Animation loop ──
      let hoverFrame = 0;
      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        const time = performance.now();

        // Animate ripple markers
        animateRipples(time);

        // FlyTo camera animation
        const flyAnim = flyToAnimRef.current;
        if (flyAnim) {
          const t = Math.min((time - flyAnim.startTime) / FLY_TO_DURATION, 1);
          const eased = easeInOut(t);
          camera.position.lerpVectors(flyAnim.startPos, flyAnim.endPos, eased);
          camera.lookAt(0, 0, 0);
          if (t >= 1) {
            flyToAnimRef.current = null;
            controls.enabled = true;
          }
        }

        // Hover raycasting (every 3 frames for perf)
        hoverFrame++;
        if (hoverFrame % 3 === 0) {
          performHoverRaycast();
        }

        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // ── Cleanup ──
      return () => {
        cancelAnimationFrame(frameIdRef.current);
        resizeObserver.disconnect();
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("click", handleClick);

        if (autoRotateTimerRef.current)
          clearTimeout(autoRotateTimerRef.current);
        if (sunIntervalRef.current) clearInterval(sunIntervalRef.current);

        // Dispose all Three.js resources
        controls.dispose();
        renderer.dispose();
        scene.traverse((obj) => {
          if (
            obj instanceof THREE.Mesh ||
            obj instanceof THREE.LineSegments ||
            obj instanceof THREE.Line
          ) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              (obj.material as THREE.Material).dispose();
            }
          }
          if (obj instanceof THREE.Points) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });

        if (heatmapMeshRef.current) {
          heatmapMeshRef.current.geometry.dispose();
          (heatmapMeshRef.current.material as THREE.Material).dispose();
        }

        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }, [
      createStarfield,
      createEarth,
      createCityLights,
      createAtmosphere,
      loadCountryBorders,
      handleMouseMove,
      handleClick,
      animateRipples,
      performHoverRaycast,
    ]);

    // ─── Sync events to markers when events change ───────────────────────
      useEffect(() => {
      syncEventMarkers(events);
    }, [events, syncEventMarkers]);

    // ─── Apply heatmap texture when environmental layer changes ──────────
    useEffect(() => {
      const heatmapMesh = heatmapMeshRef.current;
      if (!heatmapMesh) return;

      const material = heatmapMesh.material as THREE.MeshBasicMaterial;
      const isHeatmapLayer = [
        "wind",
        "temperature_anomaly",
        "aqi",
        "sea_temp",
      ].includes(activeEnvLayer);

      if (isHeatmapLayer && envLayerData) {
        console.log(
          "[GlobeRenderer] Applying heatmap for layer:",
          activeEnvLayer,
        );

        const canvas = createHeatmapTexture(activeEnvLayer, envLayerData);

        if (canvas) {
          if (heatmapTextureRef.current) {
            heatmapTextureRef.current.dispose();
          }

          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          heatmapTextureRef.current = texture;

          material.map = texture;
          material.opacity = 0.72;
          material.needsUpdate = true;

          console.log("[GlobeRenderer] Heatmap texture applied");
        } else {
          console.warn("[GlobeRenderer] Failed to create heatmap texture");
        }
      } else {
        material.opacity = 0;
        material.map = null;
        material.needsUpdate = true;

        if (heatmapTextureRef.current) {
          console.log("[GlobeRenderer] Removing heatmap texture");
          heatmapTextureRef.current.dispose();
          heatmapTextureRef.current = null;
        }
      }
    }, [activeEnvLayer, envLayerData]);

    // ─── Expose flyTo via ref ────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        flyTo(lat: number, lon: number) {
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (!camera || !controls) return;

          // Disable controls during flight
          controls.enabled = false;
          controls.autoRotate = false;

          // Calculate target position at same distance from center
          const targetDir = latLonToVector3(lat, lon, 1).normalize();
          const dist = CAMERA_DISTANCE;
          const endPos = targetDir.multiplyScalar(dist);

          flyToAnimRef.current = {
            startTime: performance.now(),
            startPos: camera.position.clone(),
            endPos,
          };
        },
      }),
      [],
    );

    return (
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none", position: "relative" }}
      />
    );
  },
);

export default GlobeRenderer;
