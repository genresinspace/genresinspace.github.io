/** WebGL2 renderer for graph nodes, edges, and arrowheads. */

import {
  EDGE_SEGMENTS,
  EDGE_WIDTH,
  EDGE_SRC_TINT_RANGE,
  EDGE_TGT_TINT_RANGE,
  EDGE_TINT_POWER,
  NODE_EDGE_SMOOTH,
  ARROW_WORLD_SPEED,
  ARROW_MARGIN_SRC,
  ARROW_MARGIN_TGT_RADIUS,
  ARROW_WIDTH_RATIO,
} from "./graphConstants";

// Re-export for consumers that previously imported from here
export { EDGE_CURVATURE } from "./graphConstants";

// Vertex shader for nodes (point sprites)
// a_size is already in device pixels from CPU side
const NODE_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_zoom;
in vec2 a_position;
in float a_size;
in vec4 a_color;
out vec4 v_color;
void main() {
  vec3 pos = u_view * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  gl_PointSize = a_size * u_zoom;
  v_color = a_color;
}`;

const NODE_FS = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float dist = dot(p, p);
  if (dist > 1.0) discard;
  // Smooth edge
  float alpha = 1.0 - smoothstep(${NODE_EDGE_SMOOTH[0].toFixed(1)}, ${NODE_EDGE_SMOOTH[1].toFixed(1)}, dist);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}`;

// Vertex shader for edges (instanced multi-segment bezier strips)
const EDGE_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_width;     // half-width in world units
uniform float u_curvature; // bezier curvature factor
// Per-vertex: quad template (x: t along curve 0..1, y: -1 or +1 across)
in vec2 a_template;
// Per-instance
in vec2 a_src;
in vec2 a_tgt;
in vec4 a_srcColor;
in vec4 a_tgtColor;
in vec4 a_srcNodeColor;
in vec4 a_tgtNodeColor;
out vec4 v_edgeColor;
out vec4 v_srcNodeColor;
out vec4 v_tgtNodeColor;
out float v_t;

vec2 bezier(vec2 p0, vec2 p1, vec2 p2, float t) {
  float u = 1.0 - t;
  return u * u * p0 + 2.0 * u * t * p1 + t * t * p2;
}

vec2 bezierTangent(vec2 p0, vec2 p1, vec2 p2, float t) {
  return 2.0 * (1.0 - t) * (p1 - p0) + 2.0 * t * (p2 - p1);
}

void main() {
  vec2 dir = a_tgt - a_src;
  float len = length(dir);
  if (len < 1e-6) {
    vec3 pos = u_view * vec3(a_src, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
    v_edgeColor = a_srcColor;
    v_srcNodeColor = a_srcNodeColor;
    v_tgtNodeColor = a_tgtNodeColor;
    v_t = 0.0;
    return;
  }

  // Deterministic sign flip so parallel edges curve opposite ways
  float sign = (a_src.x + a_src.y < a_tgt.x + a_tgt.y) ? 1.0 : -1.0;
  vec2 straight = dir / len;
  vec2 perp = vec2(-straight.y, straight.x);
  vec2 mid = (a_src + a_tgt) * 0.5;
  vec2 ctrl = mid + perp * sign * u_curvature * len;

  float t = a_template.x;
  vec2 curvePos = bezier(a_src, ctrl, a_tgt, t);
  vec2 tangent = bezierTangent(a_src, ctrl, a_tgt, t);
  float tLen = length(tangent);
  vec2 tPerp = vec2(-tangent.y, tangent.x) / tLen;

  vec2 worldPos = curvePos + tPerp * a_template.y * u_width;
  vec3 pos = u_view * vec3(worldPos, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_edgeColor = mix(a_srcColor, a_tgtColor, t);
  v_srcNodeColor = a_srcNodeColor;
  v_tgtNodeColor = a_tgtNodeColor;
  v_t = t;
}`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec4 v_edgeColor;
in vec4 v_srcNodeColor;
in vec4 v_tgtNodeColor;
in float v_t;
out vec4 fragColor;
void main() {
  // Tint edge endpoints with node colors (RGB only, preserve edge alpha)
  float srcBlend = pow(smoothstep(${EDGE_SRC_TINT_RANGE[0].toFixed(2)}, ${EDGE_SRC_TINT_RANGE[1].toFixed(2)}, v_t), ${EDGE_TINT_POWER.toFixed(1)});
  float tgtBlend = pow(smoothstep(${EDGE_TGT_TINT_RANGE[0].toFixed(2)}, ${EDGE_TGT_TINT_RANGE[1].toFixed(2)}, v_t), ${EDGE_TINT_POWER.toFixed(1)});
  vec4 color = v_edgeColor;
  color.rgb = mix(color.rgb, v_srcNodeColor.rgb, srcBlend);
  color.rgb = mix(color.rgb, v_tgtNodeColor.rgb, tgtBlend);
  fragColor = color;
}`;

// Arrow vertex shader (instanced triangles, world-space sizing)
const ARROW_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_arrowSize; // arrow length in world units
uniform float u_time;      // seconds, for animation
uniform float u_curvature; // bezier curvature factor
const float WORLD_SPEED = ${ARROW_WORLD_SPEED.toFixed(1)}; // world units per second
// Per-vertex: triangle template
in vec2 a_template;
// Per-instance: edge endpoint and direction
in vec2 a_target;
in vec2 a_direction;
in vec4 a_color;
in float a_targetSize; // node diameter in world units
in float a_phase;      // <0: static midpoint; >=0: animated phase offset
in float a_speed;      // speed multiplier (1.0 = full speed)
out vec4 v_color;

vec2 bezier(vec2 p0, vec2 p1, vec2 p2, float t) {
  float u = 1.0 - t;
  return u * u * p0 + 2.0 * u * t * p1 + t * t * p2;
}

vec2 bezierTangent(vec2 p0, vec2 p1, vec2 p2, float t) {
  return 2.0 * (1.0 - t) * (p1 - p0) + 2.0 * t * (p2 - p1);
}

void main() {
  float edgeLen = length(a_direction);
  vec2 straightDir = a_direction / edgeLen;
  vec2 source = a_target - a_direction;

  // Bezier control point (same logic as edge shader)
  float sign = (source.x + source.y < a_target.x + a_target.y) ? 1.0 : -1.0;
  vec2 perpEdge = vec2(-straightDir.y, straightDir.x);
  vec2 mid = (source + a_target) * 0.5;
  vec2 ctrl = mid + perpEdge * sign * u_curvature * edgeLen;

  float tCurve;
  if (a_phase < 0.0) {
    // Static: place arrow at centre of the curve
    tCurve = 0.5;
  } else {
    // Animated: slide along the curve within node-radius margins
    float marginSrc = u_arrowSize * ${ARROW_MARGIN_SRC.toFixed(1)};
    float marginTgt = a_targetSize * ${ARROW_MARGIN_TGT_RADIUS.toFixed(1)} + u_arrowSize;
    float usableLen = max(edgeLen - marginSrc - marginTgt, 1.0);
    float linearT = fract(a_phase + u_time * WORLD_SPEED * a_speed / edgeLen);
    // Map linear position to curve t parameter (approximate)
    tCurve = (marginSrc + linearT * usableLen) / edgeLen;
  }

  vec2 arrowTip = bezier(source, ctrl, a_target, tCurve);
  vec2 tangent = bezierTangent(source, ctrl, a_target, tCurve);
  float tLen = length(tangent);
  vec2 dir = tangent / tLen;
  vec2 perp = vec2(-dir.y, dir.x);

  // Build triangle in world space
  vec2 worldPos = arrowTip
    + dir * (a_template.x * u_arrowSize)
    + perp * (a_template.y * u_arrowSize * ${ARROW_WIDTH_RATIO.toFixed(1)});

  vec3 pos = u_view * vec3(worldPos, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_color = a_color;
}`;

const ARROW_FS = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string
): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

/** WebGL2 renderer for graph nodes, edges, and arrowheads. */
export class WebGLRenderer {
  private gl: WebGL2RenderingContext;

  // Node rendering
  private nodeProgram: WebGLProgram;
  private nodeVAO: WebGLVertexArrayObject;
  private nodePositionBuf: WebGLBuffer;
  private nodeSizeBuf: WebGLBuffer;
  private nodeColorBuf: WebGLBuffer;
  private nodeCount = 0;

  // Edge rendering (instanced quads)
  private edgeProgram: WebGLProgram;
  private edgeVAO: WebGLVertexArrayObject;
  private edgeTemplateBuf: WebGLBuffer;
  private edgeSrcBuf: WebGLBuffer;
  private edgeTgtBuf: WebGLBuffer;
  private edgeSrcColorBuf: WebGLBuffer;
  private edgeTgtColorBuf: WebGLBuffer;
  private edgeSrcNodeColorBuf: WebGLBuffer;
  private edgeTgtNodeColorBuf: WebGLBuffer;
  private edgeCount = 0;

  // Arrow rendering
  private arrowProgram: WebGLProgram;
  private arrowVAO: WebGLVertexArrayObject;
  private arrowTemplateBuf: WebGLBuffer;
  private arrowTargetBuf: WebGLBuffer;
  private arrowDirBuf: WebGLBuffer;
  private arrowColorBuf: WebGLBuffer;
  private arrowTargetSizeBuf: WebGLBuffer;
  private arrowPhaseBuf: WebGLBuffer;
  private arrowSpeedBuf: WebGLBuffer;
  private arrowCount = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Node program
    this.nodeProgram = createProgram(gl, NODE_VS, NODE_FS);
    this.nodeVAO = gl.createVertexArray()!;
    this.nodePositionBuf = gl.createBuffer()!;
    this.nodeSizeBuf = gl.createBuffer()!;
    this.nodeColorBuf = gl.createBuffer()!;

    gl.bindVertexArray(this.nodeVAO);
    const nPosLoc = gl.getAttribLocation(this.nodeProgram, "a_position");
    const nSizeLoc = gl.getAttribLocation(this.nodeProgram, "a_size");
    const nColorLoc = gl.getAttribLocation(this.nodeProgram, "a_color");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePositionBuf);
    gl.enableVertexAttribArray(nPosLoc);
    gl.vertexAttribPointer(nPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeSizeBuf);
    gl.enableVertexAttribArray(nSizeLoc);
    gl.vertexAttribPointer(nSizeLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeColorBuf);
    gl.enableVertexAttribArray(nColorLoc);
    gl.vertexAttribPointer(nColorLoc, 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Edge program (instanced quads)
    this.edgeProgram = createProgram(gl, EDGE_VS, EDGE_FS);
    this.edgeVAO = gl.createVertexArray()!;
    this.edgeTemplateBuf = gl.createBuffer()!;
    this.edgeSrcBuf = gl.createBuffer()!;
    this.edgeTgtBuf = gl.createBuffer()!;
    this.edgeSrcColorBuf = gl.createBuffer()!;
    this.edgeTgtColorBuf = gl.createBuffer()!;
    this.edgeSrcNodeColorBuf = gl.createBuffer()!;
    this.edgeTgtNodeColorBuf = gl.createBuffer()!;

    gl.bindVertexArray(this.edgeVAO);

    // Multi-segment template: EDGE_SEGMENTS quads along the curve
    // x: t parameter (0..1), y: -1 or +1 (perpendicular offset)
    const edgeTemplate = new Float32Array(EDGE_SEGMENTS * 6 * 2);
    for (let i = 0; i < EDGE_SEGMENTS; i++) {
      const t0 = i / EDGE_SEGMENTS;
      const t1 = (i + 1) / EDGE_SEGMENTS;
      const off = i * 12;
      // Triangle 1: (t0,-1), (t1,-1), (t1,+1)
      edgeTemplate[off + 0] = t0; edgeTemplate[off + 1] = -1;
      edgeTemplate[off + 2] = t1; edgeTemplate[off + 3] = -1;
      edgeTemplate[off + 4] = t1; edgeTemplate[off + 5] = 1;
      // Triangle 2: (t0,-1), (t1,+1), (t0,+1)
      edgeTemplate[off + 6] = t0; edgeTemplate[off + 7] = -1;
      edgeTemplate[off + 8] = t1; edgeTemplate[off + 9] = 1;
      edgeTemplate[off + 10] = t0; edgeTemplate[off + 11] = 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTemplateBuf);
    gl.bufferData(gl.ARRAY_BUFFER, edgeTemplate, gl.STATIC_DRAW);
    const eTmplLoc = gl.getAttribLocation(this.edgeProgram, "a_template");
    gl.enableVertexAttribArray(eTmplLoc);
    gl.vertexAttribPointer(eTmplLoc, 2, gl.FLOAT, false, 0, 0);

    // Per-instance: source position
    const eSrcLoc = gl.getAttribLocation(this.edgeProgram, "a_src");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcBuf);
    gl.enableVertexAttribArray(eSrcLoc);
    gl.vertexAttribPointer(eSrcLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eSrcLoc, 1);

    // Per-instance: target position
    const eTgtLoc = gl.getAttribLocation(this.edgeProgram, "a_tgt");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtBuf);
    gl.enableVertexAttribArray(eTgtLoc);
    gl.vertexAttribPointer(eTgtLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eTgtLoc, 1);

    // Per-instance: source color
    const eSrcColorLoc = gl.getAttribLocation(this.edgeProgram, "a_srcColor");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcColorBuf);
    gl.enableVertexAttribArray(eSrcColorLoc);
    gl.vertexAttribPointer(eSrcColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eSrcColorLoc, 1);

    // Per-instance: target color
    const eTgtColorLoc = gl.getAttribLocation(this.edgeProgram, "a_tgtColor");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtColorBuf);
    gl.enableVertexAttribArray(eTgtColorLoc);
    gl.vertexAttribPointer(eTgtColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eTgtColorLoc, 1);

    // Per-instance: source node color (for endpoint tinting)
    const eSrcNodeColorLoc = gl.getAttribLocation(
      this.edgeProgram,
      "a_srcNodeColor"
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcNodeColorBuf);
    gl.enableVertexAttribArray(eSrcNodeColorLoc);
    gl.vertexAttribPointer(eSrcNodeColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eSrcNodeColorLoc, 1);

    // Per-instance: target node color (for endpoint tinting)
    const eTgtNodeColorLoc = gl.getAttribLocation(
      this.edgeProgram,
      "a_tgtNodeColor"
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtNodeColorBuf);
    gl.enableVertexAttribArray(eTgtNodeColorLoc);
    gl.vertexAttribPointer(eTgtNodeColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(eTgtNodeColorLoc, 1);

    gl.bindVertexArray(null);

    // Arrow program (instanced)
    this.arrowProgram = createProgram(gl, ARROW_VS, ARROW_FS);
    this.arrowVAO = gl.createVertexArray()!;
    this.arrowTemplateBuf = gl.createBuffer()!;
    this.arrowTargetBuf = gl.createBuffer()!;
    this.arrowDirBuf = gl.createBuffer()!;
    this.arrowColorBuf = gl.createBuffer()!;
    this.arrowTargetSizeBuf = gl.createBuffer()!;
    this.arrowPhaseBuf = gl.createBuffer()!;
    this.arrowSpeedBuf = gl.createBuffer()!;

    gl.bindVertexArray(this.arrowVAO);

    // Template triangle: tip at (0,0), base at (-1, +-1)
    const templateData = new Float32Array([0, 0, -1, -1, -1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowTemplateBuf);
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW);
    const aTmplLoc = gl.getAttribLocation(this.arrowProgram, "a_template");
    gl.enableVertexAttribArray(aTmplLoc);
    gl.vertexAttribPointer(aTmplLoc, 2, gl.FLOAT, false, 0, 0);

    // Per-instance attributes
    const aTargLoc = gl.getAttribLocation(this.arrowProgram, "a_target");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowTargetBuf);
    gl.enableVertexAttribArray(aTargLoc);
    gl.vertexAttribPointer(aTargLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aTargLoc, 1);

    const aDirLoc = gl.getAttribLocation(this.arrowProgram, "a_direction");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowDirBuf);
    gl.enableVertexAttribArray(aDirLoc);
    gl.vertexAttribPointer(aDirLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aDirLoc, 1);

    const aAColorLoc = gl.getAttribLocation(this.arrowProgram, "a_color");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowColorBuf);
    gl.enableVertexAttribArray(aAColorLoc);
    gl.vertexAttribPointer(aAColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aAColorLoc, 1);

    const aTSizeLoc = gl.getAttribLocation(this.arrowProgram, "a_targetSize");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowTargetSizeBuf);
    gl.enableVertexAttribArray(aTSizeLoc);
    gl.vertexAttribPointer(aTSizeLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aTSizeLoc, 1);

    const aPhaseLoc = gl.getAttribLocation(this.arrowProgram, "a_phase");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowPhaseBuf);
    gl.enableVertexAttribArray(aPhaseLoc);
    gl.vertexAttribPointer(aPhaseLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPhaseLoc, 1);

    const aSpeedLoc = gl.getAttribLocation(this.arrowProgram, "a_speed");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowSpeedBuf);
    gl.enableVertexAttribArray(aSpeedLoc);
    gl.vertexAttribPointer(aSpeedLoc, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSpeedLoc, 1);

    gl.bindVertexArray(null);
  }

  /** Upload node positions (flat x,y pairs). Called once at init. */
  setNodePositions(positions: Float32Array): void {
    const gl = this.gl;
    this.nodeCount = positions.length / 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodePositionBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }

  /** Upload node sizes (in device pixels). Called when selection/hover changes. */
  setNodeSizes(sizes: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeSizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
  }

  /** Upload node colors (RGBA float). Called when selection/hover/theme changes. */
  setNodeColors(colors: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
  }

  /** Upload edge endpoint positions (2 vertices per edge, flat x,y pairs).
   *  Layout: [src0.x, src0.y, tgt0.x, tgt0.y, src1.x, ...] */
  setEdgePositions(positions: Float32Array): void {
    const gl = this.gl;
    this.edgeCount = positions.length / 4;
    // Split interleaved [sx,sy,tx,ty,...] into separate src/tgt arrays
    const src = new Float32Array(this.edgeCount * 2);
    const tgt = new Float32Array(this.edgeCount * 2);
    for (let i = 0; i < this.edgeCount; i++) {
      src[i * 2] = positions[i * 4];
      src[i * 2 + 1] = positions[i * 4 + 1];
      tgt[i * 2] = positions[i * 4 + 2];
      tgt[i * 2 + 1] = positions[i * 4 + 3];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcBuf);
    gl.bufferData(gl.ARRAY_BUFFER, src, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tgt, gl.STATIC_DRAW);
  }

  /** Upload edge colors (RGBA per vertex, 2 per edge).
   *  Layout: [srcR,G,B,A, tgtR,G,B,A, ...] */
  setEdgeColors(colors: Float32Array): void {
    const gl = this.gl;
    // Split interleaved [srcRGBA, tgtRGBA, ...] into separate arrays
    const srcColors = new Float32Array(this.edgeCount * 4);
    const tgtColors = new Float32Array(this.edgeCount * 4);
    for (let i = 0; i < this.edgeCount; i++) {
      srcColors[i * 4] = colors[i * 8];
      srcColors[i * 4 + 1] = colors[i * 8 + 1];
      srcColors[i * 4 + 2] = colors[i * 8 + 2];
      srcColors[i * 4 + 3] = colors[i * 8 + 3];
      tgtColors[i * 4] = colors[i * 8 + 4];
      tgtColors[i * 4 + 1] = colors[i * 8 + 5];
      tgtColors[i * 4 + 2] = colors[i * 8 + 6];
      tgtColors[i * 4 + 3] = colors[i * 8 + 7];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, srcColors, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tgtColors, gl.DYNAMIC_DRAW);
  }

  /** Upload per-edge node colors for endpoint tinting (RGBA per endpoint). */
  setEdgeNodeColors(
    srcNodeColors: Float32Array,
    tgtNodeColors: Float32Array
  ): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeSrcNodeColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, srcNodeColors, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTgtNodeColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tgtNodeColors, gl.DYNAMIC_DRAW);
  }

  /** Upload arrow instance data. */
  setArrows(
    targets: Float32Array,
    directions: Float32Array,
    colors: Float32Array,
    targetSizes: Float32Array,
    phases: Float32Array,
    speeds: Float32Array
  ): void {
    const gl = this.gl;
    this.arrowCount = targets.length / 2;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowTargetBuf);
    gl.bufferData(gl.ARRAY_BUFFER, targets, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowDirBuf);
    gl.bufferData(gl.ARRAY_BUFFER, directions, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowTargetSizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, targetSizes, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowPhaseBuf);
    gl.bufferData(gl.ARRAY_BUFFER, phases, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowSpeedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, speeds, gl.DYNAMIC_DRAW);
  }

  /** Render frame. */
  render(
    viewMatrix: Float32Array,
    backgroundColor: [number, number, number, number],
    arrowSizeScale: number,
    cameraZoom: number,
    time: number,
    curvature: number
  ): void {
    const gl = this.gl;
    gl.clearColor(...backgroundColor);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw edges (instanced quads)
    if (this.edgeCount > 0) {
      gl.useProgram(this.edgeProgram);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(this.edgeProgram, "u_view"),
        false,
        viewMatrix
      );
      gl.uniform1f(
        gl.getUniformLocation(this.edgeProgram, "u_width"),
        EDGE_WIDTH
      );
      gl.uniform1f(
        gl.getUniformLocation(this.edgeProgram, "u_curvature"),
        curvature
      );
      gl.bindVertexArray(this.edgeVAO);
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        EDGE_SEGMENTS * 6,
        this.edgeCount
      );
    }

    // Draw arrows
    if (this.arrowCount > 0) {
      gl.useProgram(this.arrowProgram);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(this.arrowProgram, "u_view"),
        false,
        viewMatrix
      );
      gl.uniform1f(
        gl.getUniformLocation(this.arrowProgram, "u_arrowSize"),
        arrowSizeScale
      );
      gl.uniform1f(
        gl.getUniformLocation(this.arrowProgram, "u_time"),
        time
      );
      gl.uniform1f(
        gl.getUniformLocation(this.arrowProgram, "u_curvature"),
        curvature
      );
      gl.bindVertexArray(this.arrowVAO);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.arrowCount);
    }

    // Draw nodes (on top)
    if (this.nodeCount > 0) {
      gl.useProgram(this.nodeProgram);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(this.nodeProgram, "u_view"),
        false,
        viewMatrix
      );
      gl.uniform1f(
        gl.getUniformLocation(this.nodeProgram, "u_zoom"),
        cameraZoom
      );
      gl.bindVertexArray(this.nodeVAO);
      gl.drawArrays(gl.POINTS, 0, this.nodeCount);
    }

    gl.bindVertexArray(null);
  }

  /** Clean up all GL resources. */
  destroy(): void {
    const gl = this.gl;
    gl.deleteProgram(this.nodeProgram);
    gl.deleteProgram(this.edgeProgram);
    gl.deleteProgram(this.arrowProgram);
    gl.deleteVertexArray(this.nodeVAO);
    gl.deleteVertexArray(this.edgeVAO);
    gl.deleteVertexArray(this.arrowVAO);
    gl.deleteBuffer(this.nodePositionBuf);
    gl.deleteBuffer(this.nodeSizeBuf);
    gl.deleteBuffer(this.nodeColorBuf);
    gl.deleteBuffer(this.edgeTemplateBuf);
    gl.deleteBuffer(this.edgeSrcBuf);
    gl.deleteBuffer(this.edgeTgtBuf);
    gl.deleteBuffer(this.edgeSrcColorBuf);
    gl.deleteBuffer(this.edgeTgtColorBuf);
    gl.deleteBuffer(this.edgeSrcNodeColorBuf);
    gl.deleteBuffer(this.edgeTgtNodeColorBuf);
    gl.deleteBuffer(this.arrowTemplateBuf);
    gl.deleteBuffer(this.arrowTargetBuf);
    gl.deleteBuffer(this.arrowDirBuf);
    gl.deleteBuffer(this.arrowColorBuf);
    gl.deleteBuffer(this.arrowTargetSizeBuf);
    gl.deleteBuffer(this.arrowPhaseBuf);
    gl.deleteBuffer(this.arrowSpeedBuf);
  }
}
