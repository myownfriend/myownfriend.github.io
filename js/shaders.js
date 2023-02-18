export const OKLAB_to_SRGB = `
    vec3 OKLAB_to_SRGB(vec3 OKLAB) {
        vec3 LMS = mat3(
            1.0000000000,  1.0000000000, 1.0000000000, 
            0.3963377774, -0.1055613458,-0.0894841775, 
            0.2158037573, -0.0638541728,-1.2914855480) * OKLAB;
        vec3 RGB = mat3(
             4.0767416621, -1.2684380046, -0.0041960863,
            -3.3077115913,  2.6097574011, -0.7034186147,
             0.2309699292, -0.3413193965,  1.7076147010) * pow(LMS, vec3(3.0));
        return mix(1.055 * pow(RGB, vec3(1.0/2.4)) - 0.055, RGB * 12.92, lessThanEqual(RGB, vec3(0.0031308)));
    }`;

export const SRGB_to_OKLAB = `
    vec3 SRGB_to_OKLAB(vec3 sRGB) {
        vec3 RGB = mix(pow((sRGB + 0.055) / 1.055, vec3(2.4)), sRGB / 12.92, lessThanEqual(sRGB,vec3(0.04045)));
        vec3 LMS = mat3(
             0.4122214708,  0.2119034982, 0.0883024619, 
             0.5363325363,  0.6806995451, 0.2817188376, 
             0.0514459929,  0.1073969566, 0.6299787005) * RGB;
        return mat3(
             0.2104542553,  1.9779984951, 0.0259040371,
             0.7936177850, -2.4285922050, 0.7827717662,
            -0.0040720468,  0.4505937099,-0.8086757660) * (sign(LMS) * pow(abs(LMS), vec3(0.3333333333333)));
    }`;

export const dither = `
    vec3 ScreenSpaceDither(vec2 vScreenPos, float colorDepth) {
        vec3 vDither = vec3(dot(vec2(131.0, 312.0), vScreenPos.xy + iTime));
        vDither.rgb = fract(vDither.rgb / vec3(103.0, 71.0, 97.0)) - vec3(0.5, 0.5, 0.5);
        return (vDither.rgb / colorDepth) * 0.375;
    }`;