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

// Vertex shader for edges (GL_LINES)
const EDGE_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
in vec2 a_position;
in vec4 a_color;
out vec4 v_color;
void main() {
  vec3 pos = u_view * vec3(a_position, 1.0);
  gl_Position = vec4(pos.xy, 0.0, 1.0);
  v_color = a_color;
}`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}`;

// Arrow vertex shader (instanced triangles)
// u_zoom is the camera zoom in pixels-per-world-unit (NOT the view matrix element)
const ARROW_VS = `#version 300 es
precision highp float;
uniform mat3 u_view;
uniform float u_arrowSize;
uniform float u_zoom;
// Per-vertex: triangle template
in vec2 a_template;
// Per-instance: edge endpoint and direction
in vec2 a_target;
in vec2 a_direction;
in vec4 a_color;
in float a_targetSize;
out vec4 v_color;
void main() {
  // Direction in world space, normalized
  vec2 dir = normalize(a_direction);
  vec2 perp = vec2(-dir.y, dir.x);

  // Convert pixel sizes to world sizes using camera zoom
  // a_targetSize is in device pixels, u_zoom is device pixels per world unit
  float nodeRadiusWorld = a_targetSize * 0.5 / u_zoom;
  float arrowLenWorld = u_arrowSize * 3.0 / u_zoom;

  // Arrow tip at target, offset inward by node radius
  vec2 arrowTip = a_target - dir * nodeRadiusWorld;

  // Build triangle in world space
  vec2 worldPos = arrowTip
    + dir * (a_template.x * arrowLenWorld)
    + perp * (a_template.y * arrowLenWorld * 0.4);

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

  // Edge rendering
  private edgeProgram: WebGLProgram;
  private edgeVAO: WebGLVertexArrayObject;
  private edgePositionBuf: WebGLBuffer;
  private edgeColorBuf: WebGLBuffer;
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

    // Edge program
    this.edgeProgram = createProgram(gl, EDGE_VS, EDGE_FS);
    this.edgeVAO = gl.createVertexArray()!;
    this.edgePositionBuf = gl.createBuffer()!;
    this.edgeColorBuf = gl.createBuffer()!;

    gl.bindVertexArray(this.edgeVAO);
    const ePosLoc = gl.getAttribLocation(this.edgeProgram, "a_position");
    const eColorLoc = gl.getAttribLocation(this.edgeProgram, "a_color");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePositionBuf);
    gl.enableVertexAttribArray(ePosLoc);
    gl.vertexAttribPointer(ePosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeColorBuf);
    gl.enableVertexAttribArray(eColorLoc);
    gl.vertexAttribPointer(eColorLoc, 4, gl.FLOAT, false, 0, 0);

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

  /** Upload edge vertex positions (2 vertices per edge, flat x,y pairs). */
  setEdgePositions(positions: Float32Array): void {
    const gl = this.gl;
    this.edgeCount = positions.length / 4; // 2 vertices * 2 components per edge
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePositionBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }

  /** Upload edge colors (RGBA per vertex, 2 per edge). */
  setEdgeColors(colors: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeColorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
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

    // Draw edges
    if (this.edgeCount > 0) {
      gl.useProgram(this.edgeProgram);
      gl.uniformMatrix3fv(
        gl.getUniformLocation(this.edgeProgram, "u_view"),
        false,
        viewMatrix
      );
      gl.bindVertexArray(this.edgeVAO);
      gl.drawArrays(gl.LINES, 0, this.edgeCount * 2);
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
        gl.getUniformLocation(this.arrowProgram, "u_zoom"),
        cameraZoom
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
    gl.deleteBuffer(this.edgePositionBuf);
    gl.deleteBuffer(this.edgeColorBuf);
    gl.deleteBuffer(this.arrowTemplateBuf);
    gl.deleteBuffer(this.arrowTargetBuf);
    gl.deleteBuffer(this.arrowDirBuf);
    gl.deleteBuffer(this.arrowColorBuf);
    gl.deleteBuffer(this.arrowTargetSizeBuf);
  }
}
