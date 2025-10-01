const MODES = Object.freeze({
  solid: "solid",
  gradient: "gradient",
});

const isGradientColor = (value) =>
  value && typeof value === "object" && value.type === "gradient";

const normalizeColorInput = (value) => {
  if (!value) return "#561ecb";
  if (typeof value === "string") return value;
  if (isGradientColor(value)) return value.top;
  return "#561ecb";
};

const buildGradient = (topHex, bottomHex) => ({
  type: "gradient",
  top: topHex,
  bottom: bottomHex,
});

const HEX_LENGTHS = [3, 4, 6, 8];

const rgbToHsv = (r, g, b, a = 1) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === rn) {
      h = (gn - bn) / delta;
    } else if (max === gn) {
      h = 2 + (bn - rn) / delta;
    } else {
      h = 4 + (rn - gn) / delta;
    }

    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return {
    h,
    s,
    v,
    a,
  };
};

const parseHexColor = (value) => {
  const normalized = value.startsWith("#") ? value : `#${value}`;
  const hexBody = normalized.slice(1);

  if (!HEX_LENGTHS.includes(hexBody.length)) {
    return null;
  }

  const cleaned = hexBody.replace(/[^0-9A-Fa-f]/g, "");
  if (cleaned.length !== hexBody.length) {
    return null;
  }

  if (!(window.CSS?.supports?.("color", `#${cleaned}`) ?? true)) {
    return null;
  }

  const fullHex =
    cleaned.length === 3 || cleaned.length === 4
      ? cleaned
          .split("")
          .map((char) => char + char)
          .join("")
      : cleaned;

  const hasAlpha = fullHex.length === 8;

  const hex = `#${hasAlpha ? fullHex.slice(0, 6) : fullHex}`.toUpperCase();
  const alpha = hasAlpha ? fullHex.slice(6) : null;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  const a = alpha ? parseInt(alpha, 16) / 255 : 1;

  return {
    hex,
    rgb: { r, g, b, a },
    hsv: rgbToHsv(r, g, b, a),
  };
};

const toColorObject = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return parseHexColor(value);
  }

  if (typeof value === "object" && value.hex) {
    const parsed = parseHexColor(value.hex);
    if (!parsed) {
      return null;
    }
    return {
      hex: parsed.hex,
      rgb: value.rgb ?? parsed.rgb,
      hsv: value.hsv ?? parsed.hsv,
    };
  }

  return null;
};

export {
  MODES,
  isGradientColor,
  normalizeColorInput,
  buildGradient,
  parseHexColor,
  rgbToHsv,
  toColorObject,
};
