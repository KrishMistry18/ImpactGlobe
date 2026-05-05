/** Custom GLSL shaders for the globe atmosphere and effects */

// Atmosphere glow — renders a soft halo around the earth
export const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const atmosphereFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), power);
    gl_FragColor = vec4(glowColor, fresnel * intensity);
  }
`

// Earth surface — adds subtle grid overlay and fresnel rim glow
export const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const earthFragmentShader = `
  uniform sampler2D earthTexture;
  uniform float gridOpacity;
  uniform vec3 rimColor;
  uniform float rimPower;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Sample earth night texture
    vec4 texColor = texture2D(earthTexture, vUv);

    // Darken the texture to match our theme (multiply by dark tint)
    vec3 color = texColor.rgb * 0.7;

    // Add subtle lat/lon grid lines
    float lat = vUv.y * 180.0;
    float lon = vUv.x * 360.0;
    float latLine = 1.0 - smoothstep(0.45, 0.5, abs(fract(lat / 30.0) - 0.5));
    float lonLine = 1.0 - smoothstep(0.45, 0.5, abs(fract(lon / 30.0) - 0.5));
    float grid = max(latLine, lonLine) * gridOpacity;
    color += vec3(0.15, 0.25, 0.45) * grid;

    // Fresnel rim glow
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim = pow(rim, rimPower);
    color += rimColor * rim * 0.4;

    gl_FragColor = vec4(color, 1.0);
  }
`
