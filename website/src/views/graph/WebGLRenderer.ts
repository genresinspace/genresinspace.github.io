/** WebGL2 renderer for graph nodes, edges, and arrowheads. */

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
  float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}`;

// Vertex shader for edges (instanced quads for consistent line width)
const EDGE_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_width; // half-width in world units
// Per-vertex: quad template (x: 0 or 1 along edge, y: -1 or +1 across)
in vec2 a_template;
// Per-instance
in vec2 a_src;
in vec2 a_tgt;
in vec4 a_srcColor;
in vec4 a_tgtColor;
out vec4 v_color;
void main() {
  // Edge direction in world space
  vec2 dir = a_tgt - a_src;
  float len = length(dir);
  if (len < 1e-6) {
    vec3 pos = u_view * vec3(a_src, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
    v_color = a_srcColor;
    return;
  }
  vec2 perp = vec2(-dir.y, dir.x) / len;

  // Interpolate along edge, offset perpendicular in world space
  vec2 worldPos = mix(a_src, a_tgt, a_template.x)
                + perp * a_template.y * u_width;
  vec3 pos = u_view * vec3(worldPos, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_color = mix(a_srcColor, a_tgtColor, a_template.x);
}`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}`;

// Arrow vertex shader (instanced triangles, world-space sizing)
const ARROW_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_arrowSize; // arrow length in world units
// Per-vertex: triangle template
in vec2 a_template;
// Per-instance: edge endpoint and direction
in vec2 a_target;
in vec2 a_direction;
in vec4 a_color;
in float a_targetSize; // node diameter in world units
out vec4 v_color;
void main() {
  // Direction in world space
  float edgeLen = length(a_direction);
  vec2 dir = a_direction / edgeLen;
  vec2 perp = vec2(-dir.y, dir.x);

  // Place arrow at centre of the edge
  vec2 arrowTip = a_target - dir * edgeLen * 0.5;

  // Build triangle in world space
  vec2 worldPos = arrowTip
    + dir * (a_template.x * u_arrowSize)
    + perp * (a_template.y * u_arrowSize * 0.4);

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
  private edgeCount = 0;

  // Arrow rendering
  private arrowProgram: WebGLProgram;
  private arrowVAO: WebGLVertexArrayObject;
  private arrowTemplateBuf: WebGLBuffer;
  private arrowTargetBuf: WebGLBuffer;
  private arrowDirBuf: WebGLBuffer;
  private arrowColorBuf: WebGLBuffer;
  private arrowTargetSizeBuf: WebGLBuffer;
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

    gl.bindVertexArray(this.edgeVAO);

    // Quad template: two triangles forming a strip along the edge
    // x: 0=src end, 1=tgt end; y: -1 or +1 (perpendicular offset)
    const edgeTemplate = new Float32Array([
      0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1,
    ]);
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

    gl.bindVertexArray(null);

    // Arrow program (instanced)
    this.arrowProgram = createProgram(gl, ARROW_VS, ARROW_FS);
    this.arrowVAO = gl.createVertexArray()!;
    this.arrowTemplateBuf = gl.createBuffer()!;
    this.arrowTargetBuf = gl.createBuffer()!;
    this.arrowDirBuf = gl.createBuffer()!;
    this.arrowColorBuf = gl.createBuffer()!;
    this.arrowTargetSizeBuf = gl.createBuffer()!;

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

  /** Upload arrow instance data. */
  setArrows(
    targets: Float32Array,
    directions: Float32Array,
    colors: Float32Array,
    targetSizes: Float32Array
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
  }

  /** Render frame. */
  render(
    viewMatrix: Float32Array,
    backgroundColor: [number, number, number, number],
    arrowSizeScale: number,
    cameraZoom: number
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
        0.5 // half-width in world units; scales with zoom like nodes
      );
      gl.bindVertexArray(this.edgeVAO);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.edgeCount);
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
    gl.deleteBuffer(this.arrowTemplateBuf);
    gl.deleteBuffer(this.arrowTargetBuf);
    gl.deleteBuffer(this.arrowDirBuf);
    gl.deleteBuffer(this.arrowColorBuf);
    gl.deleteBuffer(this.arrowTargetSizeBuf);
  }
}
