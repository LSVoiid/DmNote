import React, { memo, useEffect, useRef } from "react";
import {
  Renderer,
  Camera,
  Transform,
  Program,
  Mesh,
  Geometry,
  Vec3,
} from "ogl";
import { animationScheduler } from "../../utils/animationScheduler";

const MAX_NOTES = 2048;

// sRGB to Linear lookup table (0-255 범위, 미리 계산)
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] =
    c < 0.04045
      ? c * 0.0773993808
      : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

// Linear to sRGB (Three.js와 정확히 동일)
const linearToSRGB = (c) => {
  if (c <= 0.0031308) return c * 12.92;
  return 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
};

// Hex to Linear RGB (lookup table 사용)
const parseColor = (hex) => {
  const color = hex.replace("#", "");
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  return [SRGB_TO_LINEAR[r], SRGB_TO_LINEAR[g], SRGB_TO_LINEAR[b]];
};

const convertLinearToSRGB = (rgb) => {
  return [linearToSRGB(rgb[0]), linearToSRGB(rgb[1]), linearToSRGB(rgb[2])];
};

const extractColorStops = (color, fallback = "#FFFFFF") => {
  if (!color) {
    const c = parseColor(fallback);
    return {
      top: c,
      bottom: [...c],
      isGradient: false,
    };
  }
  if (typeof color === "string") {
    const solid = parseColor(color);
    return { top: solid, bottom: [...solid], isGradient: false };
  }
  if (typeof color === "object" && color.type === "gradient") {
    return {
      top: parseColor(color.top ?? fallback),
      bottom: parseColor(color.bottom ?? fallback),
      isGradient: true,
    };
  }
  const parsed = parseColor(fallback);
  return { top: parsed, bottom: [...parsed], isGradient: false };
};

// 버텍스 셰이더
const vertexShader = `
  attribute vec3 position;
  attribute vec3 noteInfo; // x: startTime, y: endTime, z: trackX
  attribute vec2 noteSize; // x: width, y: trackBottomY
  attribute vec4 noteColorTop;
  attribute vec4 noteColorBottom;
  attribute float noteRadius;
  attribute float trackIndex;

  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uScreenHeight;
  uniform float uTrackHeight;
  uniform float uReverse;
  uniform float uShortThresholdMs;
  uniform float uShortMinLengthPx;
  uniform float uDelayEnabled;

  varying vec4 vColorTop;
  varying vec4 vColorBottom;
  varying vec2 vLocalPos;
  varying vec2 vHalfSize;
  varying float vRadius;
  varying float vTrackTopY;
  varying float vTrackBottomY;
  varying float vReverse;
  varying float vNoteTopY;
  varying float vNoteBottomY;

  void main() {
    float startTime = noteInfo.x;
    float endTime = noteInfo.y;
    float trackX = noteInfo.z;
    float trackBottomY = noteSize.y;
    float noteWidth = noteSize.x;

    if (startTime == 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
      vColorTop = vec4(0.0);
      vColorBottom = vec4(0.0);
      return;
    }

    bool isActive = endTime == 0.0;
    float rawNoteLength = 0.0;
    float bottomCanvasY = 0.0;

    if (isActive) {
      rawNoteLength = max(0.0, (uTime - startTime) * uFlowSpeed / 1000.0);
      bottomCanvasY = trackBottomY;
    } else {
      rawNoteLength = max(0.0, (endTime - startTime) * uFlowSpeed / 1000.0);
      float travel = (uTime - endTime) * uFlowSpeed / 1000.0;
      float trackTopY_local = trackBottomY - uTrackHeight;
      if (uReverse < 0.5) {
        bottomCanvasY = trackBottomY - travel;
      } else {
        bottomCanvasY = trackTopY_local + travel;
      }
    }

    float noteLength = min(rawNoteLength, uTrackHeight);
    float noteTopY, noteBottomY;
    
    if (isActive) {
      if (uReverse < 0.5) {
        noteBottomY = trackBottomY;
        noteTopY = trackBottomY - noteLength;
      } else {
        float trackTopY_local = trackBottomY - uTrackHeight;
        noteTopY = trackTopY_local;
        noteBottomY = trackTopY_local + noteLength;
      }
    } else {
      if (uReverse < 0.5) {
        float travel = (uTime - endTime) * uFlowSpeed / 1000.0;
        noteBottomY = trackBottomY - travel;
        noteTopY = noteBottomY - noteLength;
      } else {
        float travel = (uTime - endTime) * uFlowSpeed / 1000.0;
        float trackTopY_local = trackBottomY - uTrackHeight;
        noteTopY = trackTopY_local + travel;
        noteBottomY = noteTopY + noteLength;
      }

      if (uDelayEnabled > 0.5) {
        float durationMs = max(0.0, endTime - startTime);
        if (durationMs <= uShortThresholdMs) {
          float desired = uShortMinLengthPx;
          float current = noteBottomY - noteTopY;
          if (current < desired) {
            if (uReverse < 0.5) {
              noteTopY = noteBottomY - desired;
            } else {
              noteBottomY = noteTopY + desired;
            }
          }
        }
      }
    }
    
    float trackTopY = trackBottomY - uTrackHeight;
    noteTopY = max(noteTopY, trackTopY);
    noteBottomY = min(noteBottomY, trackBottomY);

    if (noteBottomY <= trackTopY) {
      gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
      vColorTop = vec4(0.0);
      vColorBottom = vec4(0.0);
      return;
    }
    
    if (noteBottomY < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
      vColorTop = vec4(0.0);
      vColorBottom = vec4(0.0);
      return;
    }

    noteLength = noteBottomY - noteTopY;
    float centerCanvasY = (noteTopY + noteBottomY) / 2.0;
    float centerWorldY = uScreenHeight - centerCanvasY;

    vec3 transformed = vec3(position.x, position.y, position.z);
    transformed.x *= noteWidth;
    transformed.y *= noteLength;
    transformed.x += trackX + noteWidth / 2.0;
    transformed.y += centerWorldY;
    transformed.z = 0.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);

    vColorTop = noteColorTop;
    vColorBottom = noteColorBottom;
    vHalfSize = vec2(noteWidth, noteLength) * 0.5;
    vLocalPos = vec2(position.x * noteWidth, position.y * noteLength);
    vRadius = noteRadius;
    vTrackTopY = trackTopY;
    vTrackBottomY = trackBottomY;
    vReverse = uReverse;
    vNoteTopY = noteTopY;
    vNoteBottomY = noteBottomY;
  }
`;

// 프래그먼트 셰이더
const fragmentShader = `
  precision highp float;

  uniform float uScreenHeight;
  uniform float uFadePosition;
  
  varying vec4 vColorTop;
  varying vec4 vColorBottom;
  varying vec2 vLocalPos;
  varying vec2 vHalfSize;
  varying float vRadius;
  varying float vTrackTopY;
  varying float vTrackBottomY;
  varying float vReverse;
  varying float vNoteTopY;
  varying float vNoteBottomY;

  void main() {
    float currentDOMY = uScreenHeight - gl_FragCoord.y;
    float trackHeight = max(vTrackBottomY - vTrackTopY, 0.0001);
    float gradientRatio = clamp((currentDOMY - vTrackTopY) / trackHeight, 0.0, 1.0);
    float trackRelativeY = gradientRatio;

    float fadePosFlag = uFadePosition;
    bool invertForFade = false;
    if (fadePosFlag < 0.5) {
      invertForFade = (vReverse > 0.5);
    } else if (abs(fadePosFlag - 1.0) < 0.1) {
      invertForFade = false;
    } else {
      invertForFade = true;
    }
    if (invertForFade) {
      trackRelativeY = 1.0 - trackRelativeY;
    }

    vec4 baseColor = mix(vColorTop, vColorBottom, gradientRatio);
    float fadeZone = 50.0;
    float fadeRatio = fadeZone / trackHeight;
    float alpha = baseColor.a;

    float r = clamp(vRadius, 0.0, min(vHalfSize.x, vHalfSize.y));
    if (r > 0.0) {
      vec2 q = abs(vLocalPos) - (vHalfSize - vec2(r));
      float dist = length(max(q, 0.0)) - r;
      float aa = 1.0;
      float smoothAlpha = clamp(0.5 - dist / aa, 0.0, 1.0);
      if (dist > 0.5) discard;
      alpha *= smoothAlpha;
    }

    if (trackRelativeY < fadeRatio) {
      alpha *= clamp(trackRelativeY / fadeRatio, 0.0, 1.0);
    }

    // Premultiplied alpha: RGB에 alpha를 곱해서 출력 (Three.js 기본 동작)
    gl_FragColor = vec4(baseColor.rgb * alpha, alpha);
  }
`;

const buildColorAttributes = (color, opacity = 1) => {
  const { top, bottom } = extractColorStops(color);
  const srgbTop = convertLinearToSRGB(top);
  const srgbBottom = convertLinearToSRGB(bottom);
  const clampedOpacity = Math.min(Math.max(opacity, 0), 1);
  return {
    top: [...srgbTop, clampedOpacity],
    bottom: [...srgbBottom, clampedOpacity],
  };
};

export const WebGLTracksOGL = memo(
  ({ tracks, notesRef, subscribe, noteSettings, laboratoryEnabled }) => {
    const canvasRef = useRef();
    const rendererRef = useRef();
    const sceneRef = useRef();
    const cameraRef = useRef();
    const geometryRef = useRef();
    const programRef = useRef();
    const meshMapRef = useRef(new Map());
    const trackMapRef = useRef(new Map());
    const attributesMapRef = useRef(new Map());
    const colorCacheRef = useRef(new Map());
    const isAnimating = useRef(false);
    const noteTrackMapRef = useRef(new Map());

    // 1. WebGL 씬 초기 설정
    useEffect(() => {
      const canvas = canvasRef.current;
      const renderer = new Renderer({
        canvas,
        alpha: true,
        antialias: true,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        premultipliedAlpha: true, // Three.js 기본값
      });
      rendererRef.current = renderer;

      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const scene = new Transform();
      sceneRef.current = scene;

      const camera = new Camera(gl, {
        left: 0,
        right: window.innerWidth,
        top: window.innerHeight,
        bottom: 0,
        near: 1,
        far: 1000,
      });
      camera.position.z = 5;
      cameraRef.current = camera;

      // 공유 지오메트리 (Plane)
      const geometry = new Geometry(gl, {
        position: {
          size: 3,
          data: new Float32Array([
            -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5,
            0, -0.5, 0.5, 0,
          ]),
        },
      });
      geometryRef.current = geometry;

      // 공유 프로그램
      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uFlowSpeed: { value: noteSettings.speed || 180 },
          uScreenHeight: { value: window.innerHeight },
          uTrackHeight: { value: noteSettings.trackHeight || 150 },
          uReverse: { value: noteSettings.reverse ? 1.0 : 0.0 },
          uShortThresholdMs: {
            value: noteSettings.shortNoteThresholdMs || 120,
          },
          uShortMinLengthPx: { value: noteSettings.shortNoteMinLengthPx || 10 },
          uDelayEnabled: {
            value:
              laboratoryEnabled && noteSettings.delayedNoteEnabled ? 1.0 : 0.0,
          },
          uFadePosition: {
            value:
              noteSettings.fadePosition === "top"
                ? 1.0
                : noteSettings.fadePosition === "bottom"
                ? 2.0
                : 0.0,
          },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      // Three.js NormalBlending (premultipliedAlpha: true)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.blendEquation(gl.FUNC_ADD);
      programRef.current = program;

      // 트랙 엔트리 생성기
      const createTrackEntry = (track) => {
        const geo = new Geometry(gl, {
          position: {
            size: 3,
            data: new Float32Array([
              -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5,
              0, -0.5, 0.5, 0,
            ]),
          },
        });

        // 인스턴스 속성
        const noteInfoArray = new Float32Array(MAX_NOTES * 3);
        const noteSizeArray = new Float32Array(MAX_NOTES * 2);
        const noteColorArrayTop = new Float32Array(MAX_NOTES * 4);
        const noteColorArrayBottom = new Float32Array(MAX_NOTES * 4);
        const noteRadiusArray = new Float32Array(MAX_NOTES);
        const trackIndexArray = new Float32Array(MAX_NOTES);

        geo.addAttribute("noteInfo", {
          instanced: 1,
          size: 3,
          data: noteInfoArray,
        });
        geo.addAttribute("noteSize", {
          instanced: 1,
          size: 2,
          data: noteSizeArray,
        });
        geo.addAttribute("noteColorTop", {
          instanced: 1,
          size: 4,
          data: noteColorArrayTop,
        });
        geo.addAttribute("noteColorBottom", {
          instanced: 1,
          size: 4,
          data: noteColorArrayBottom,
        });
        geo.addAttribute("noteRadius", {
          instanced: 1,
          size: 1,
          data: noteRadiusArray,
        });
        geo.addAttribute("trackIndex", {
          instanced: 1,
          size: 1,
          data: trackIndexArray,
        });

        const mesh = new Mesh(gl, {
          geometry: geo,
          program: programRef.current,
        });
        mesh.setParent(sceneRef.current);
        mesh.renderOrder = track.trackIndex ?? 0;

        attributesMapRef.current.set(track.trackKey, {
          noteInfoArray,
          noteSizeArray,
          noteColorArrayTop,
          noteColorArrayBottom,
          noteRadiusArray,
          trackIndexArray,
          geometry: geo,
        });

        meshMapRef.current.set(track.trackKey, {
          mesh,
          noteIndexMap: new Map(),
          freeIndices: [],
          nextIndex: 0,
          gradient: track.gradient,
        });
      };

      const ensureTrackEntry = (trackKey) => {
        if (meshMapRef.current.has(trackKey))
          return meshMapRef.current.get(trackKey);
        const track = trackMapRef.current.get(trackKey);
        if (
          !track ||
          !geometryRef.current ||
          !programRef.current ||
          !sceneRef.current
        )
          return null;
        createTrackEntry(track);
        return meshMapRef.current.get(trackKey);
      };

      // 애니메이션 루프
      const animate = (currentTime) => {
        if (
          !rendererRef.current ||
          !sceneRef.current ||
          !cameraRef.current ||
          !programRef.current
        )
          return;

        const totalNotes = Object.values(notesRef.current).reduce(
          (sum, notes) => sum + notes.length,
          0
        );
        if (totalNotes === 0) {
          for (const { mesh } of meshMapRef.current.values()) {
            const geo = mesh.geometry;
            if (geo.attributes.noteInfo) {
              geo.attributes.noteInfo.count = 0;
            }
          }
          rendererRef.current.render({
            scene: sceneRef.current,
            camera: cameraRef.current,
          });
          return;
        }

        programRef.current.uniforms.uTime.value = currentTime;
        rendererRef.current.render({
          scene: sceneRef.current,
          camera: cameraRef.current,
        });
      };

      // 노트 이벤트 핸들러
      const handleNoteEvent = (event) => {
        if (!event) return;

        const { type, note } = event;

        if (type === "clear") {
          for (const [, entry] of meshMapRef.current) {
            entry.noteIndexMap.clear();
            entry.freeIndices.length = 0;
            entry.nextIndex = 0;
            const geo = entry.mesh.geometry;
            if (geo.attributes.noteInfo) {
              geo.attributes.noteInfo.count = 0;
            }
          }
          noteTrackMapRef.current.clear();
          if (isAnimating.current) {
            animationScheduler.remove(animate);
            isAnimating.current = false;
            requestAnimationFrame(() => {
              if (rendererRef.current) {
                rendererRef.current.gl.clear(
                  rendererRef.current.gl.COLOR_BUFFER_BIT |
                    rendererRef.current.gl.DEPTH_BUFFER_BIT
                );
              }
            });
          }
          return;
        }

        if (!note) return;

        if (type === "add") {
          const track = trackMapRef.current.get(note.keyName);
          if (!track) return;

          const entry = ensureTrackEntry(note.keyName);
          if (!entry) return;

          if (!isAnimating.current) {
            animationScheduler.add(animate);
            isAnimating.current = true;
          }

          const { mesh, noteIndexMap, freeIndices } = entry;
          const attrs = attributesMapRef.current.get(note.keyName);
          if (!attrs) return;

          const opacity =
            track.noteOpacity != null
              ? Math.min(Math.max(track.noteOpacity / 100, 0), 1)
              : 0.8;
          const colorKey =
            track.noteColor && typeof track.noteColor === "object"
              ? JSON.stringify(track.noteColor)
              : track.noteColor ?? "";
          const cacheKey = `${colorKey}|${opacity}`;
          let colorData = colorCacheRef.current.get(cacheKey);
          if (!colorData) {
            colorData = buildColorAttributes(track.noteColor, opacity);
            colorCacheRef.current.set(cacheKey, colorData);
          }

          const index = freeIndices.pop() ?? entry.nextIndex++;
          if (index >= MAX_NOTES) {
            entry.nextIndex--;
            return;
          }
          noteIndexMap.set(note.id, index);
          noteTrackMapRef.current.set(note.id, note.keyName);

          const base3 = index * 3;
          const base2 = index * 2;
          const base4 = index * 4;

          attrs.noteInfoArray.set(
            [note.startTime, 0, track.position.dx],
            base3
          );
          attrs.noteSizeArray.set([track.width, track.position.dy], base2);
          attrs.noteColorArrayTop.set(colorData.top, base4);
          attrs.noteColorArrayBottom.set(colorData.bottom, base4);
          attrs.noteRadiusArray.set([track.borderRadius || 0], index);
          attrs.trackIndexArray.set([track.trackIndex], index);

          attrs.geometry.attributes.noteInfo.needsUpdate = true;
          attrs.geometry.attributes.noteSize.needsUpdate = true;
          attrs.geometry.attributes.noteColorTop.needsUpdate = true;
          attrs.geometry.attributes.noteColorBottom.needsUpdate = true;
          attrs.geometry.attributes.noteRadius.needsUpdate = true;
          attrs.geometry.attributes.trackIndex.needsUpdate = true;

          attrs.geometry.attributes.noteInfo.count = Math.max(
            attrs.geometry.attributes.noteInfo.count || 0,
            index + 1
          );
        } else if (type === "finalize") {
          const trackKey = noteTrackMapRef.current.get(note.id);
          if (!trackKey) return;

          const entry = meshMapRef.current.get(trackKey);
          if (!entry) return;

          const index = entry.noteIndexMap.get(note.id);
          if (index === undefined) return;

          const attrs = attributesMapRef.current.get(trackKey);
          if (!attrs) return;

          const base3 = index * 3;
          attrs.noteInfoArray.set([note.endTime], base3 + 1);
          attrs.geometry.attributes.noteInfo.needsUpdate = true;
        } else if (type === "cleanup") {
          for (const noteId of note.ids) {
            const trackKey = noteTrackMapRef.current.get(noteId);
            if (!trackKey) continue;

            const entry = meshMapRef.current.get(trackKey);
            if (!entry) {
              noteTrackMapRef.current.delete(noteId);
              continue;
            }

            const index = entry.noteIndexMap.get(noteId);
            if (index !== undefined) {
              const attrs = attributesMapRef.current.get(trackKey);
              if (!attrs) continue;

              const base3 = index * 3;
              attrs.noteInfoArray.set([0, 0], base3);

              entry.noteIndexMap.delete(noteId);
              entry.freeIndices.push(index);
              noteTrackMapRef.current.delete(noteId);
            }
          }

          for (const attrs of attributesMapRef.current.values()) {
            attrs.geometry.attributes.noteInfo.needsUpdate = true;
          }

          if (noteTrackMapRef.current.size === 0 && isAnimating.current) {
            animationScheduler.remove(animate);
            isAnimating.current = false;
            requestAnimationFrame(() => {
              if (rendererRef.current) {
                rendererRef.current.gl.clear(
                  rendererRef.current.gl.COLOR_BUFFER_BIT |
                    rendererRef.current.gl.DEPTH_BUFFER_BIT
                );
              }
            });
          }
        }
      };

      const unsubscribe = subscribe(handleNoteEvent);

      return () => {
        unsubscribe();
        if (isAnimating.current) {
          animationScheduler.remove(animate);
        }
        for (const [, entry] of meshMapRef.current) {
          entry.mesh.geometry.remove();
        }
        meshMapRef.current.clear();
        attributesMapRef.current.clear();
        geometryRef.current?.remove();
      };
    }, []);

    // 2. 트랙 정보 업데이트
    useEffect(() => {
      const newTrackMap = new Map();
      tracks.forEach((track) => {
        newTrackMap.set(track.trackKey, track);
      });
      trackMapRef.current = newTrackMap;

      tracks.forEach((track) => {
        const entry = meshMapRef.current.get(track.trackKey);
        if (entry) {
          entry.mesh.renderOrder = track.trackIndex ?? 0;
        }
      });
    }, [tracks]);

    // 3. 노트 설정 업데이트
    useEffect(() => {
      if (programRef.current) {
        programRef.current.uniforms.uFlowSpeed.value =
          noteSettings.speed || 180;
        programRef.current.uniforms.uTrackHeight.value =
          noteSettings.trackHeight || 150;
        programRef.current.uniforms.uReverse.value = noteSettings.reverse
          ? 1.0
          : 0.0;
        programRef.current.uniforms.uShortThresholdMs.value =
          noteSettings.shortNoteThresholdMs || 120;
        programRef.current.uniforms.uShortMinLengthPx.value =
          noteSettings.shortNoteMinLengthPx || 10;
        programRef.current.uniforms.uDelayEnabled.value =
          laboratoryEnabled && noteSettings.delayedNoteEnabled ? 1.0 : 0.0;
        programRef.current.uniforms.uFadePosition.value =
          noteSettings.fadePosition === "top"
            ? 1.0
            : noteSettings.fadePosition === "bottom"
            ? 2.0
            : 0.0;
      }
    }, [
      noteSettings.speed,
      noteSettings.trackHeight,
      noteSettings.reverse,
      noteSettings.shortNoteThresholdMs,
      noteSettings.shortNoteMinLengthPx,
      noteSettings.delayedNoteEnabled,
      laboratoryEnabled,
      noteSettings.fadePosition,
    ]);

    // 4. 윈도우 리사이즈 처리
    useEffect(() => {
      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (rendererRef.current) {
          rendererRef.current.setSize(width, height);
        }
        if (cameraRef.current) {
          cameraRef.current.orthographic({
            left: 0,
            right: width,
            top: height,
            bottom: 0,
            near: 1,
            far: 1000,
          });
        }
        if (programRef.current) {
          programRef.current.uniforms.uScreenHeight.value = height;
        }
      };

      window.addEventListener("resize", handleResize);
      handleResize();

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    );
  }
);
