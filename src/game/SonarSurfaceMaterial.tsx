import { useCallback } from "react";
import type { ThreeElements } from "@react-three/fiber";
import type { MeshStandardMaterial, Vector3 } from "three";

export const SONAR_RANGE = 650;
export const SONAR_SPEED = 260;
export const SONAR_TRAVEL_TIME = SONAR_RANGE / SONAR_SPEED;
const ECHO_FADE_TIME = 2.4;

export type SonarPulse = {
  origin: { value: Vector3 };
  age: { value: number };
};

type Props = ThreeElements["meshStandardMaterial"] & {
  pulse: SonarPulse;
  enemy?: boolean;
};

// Extend the existing surface pass: no duplicate meshes, extra lights, or
// per-frame material uploads for individual ice instances or submarines.
export default function SonarSurfaceMaterial({ pulse, enemy = false, ...props }: Props) {
  const onBeforeCompile = useCallback<MeshStandardMaterial["onBeforeCompile"]>((shader) => {
    shader.uniforms.sonarOrigin = pulse.origin;
    shader.uniforms.sonarAge = pulse.age;
    shader.vertexShader = `varying vec3 vSonarPosition;\n${shader.vertexShader}`.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 sonarPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        sonarPosition = instanceMatrix * sonarPosition;
      #endif
      vSonarPosition = (modelMatrix * sonarPosition).xyz;`,
    );
    shader.fragmentShader = `
      uniform vec3 sonarOrigin;
      uniform float sonarAge;
      varying vec3 vSonarPosition;
      ${shader.fragmentShader}
    `.replace("#include <fog_fragment>", `
      #include <fog_fragment>
      // Only sonar returns bypass the water fog. Ordinary surfaces retain it,
      // and depth testing still hides surfaces behind solid obstacles.
      if (sonarAge < ${(SONAR_TRAVEL_TIME + ECHO_FADE_TIME).toFixed(1)}) {
        float sonarDistance = distance(vSonarPosition, sonarOrigin);
        float echoAge = sonarAge - sonarDistance / ${SONAR_SPEED.toFixed(1)};
        float echo = step(sonarDistance, ${SONAR_RANGE.toFixed(1)})
          * smoothstep(0.0, 0.08, echoAge)
          * (1.0 - smoothstep(0.15, ${ECHO_FADE_TIME.toFixed(1)}, echoAge));
        float shape = 0.45 + 0.55 * abs(dot(normal, normalize(vec3(0.3, 0.7, 1.0))));
        vec3 echoColor = ${enemy ? "vec3(1.0, 0.38, 0.16)" : "vec3(0.12, 0.92, 0.82)"};
        gl_FragColor.rgb = mix(gl_FragColor.rgb, echoColor * shape, echo * 0.85);
      }
    `);
  }, [pulse, enemy]);
  // Both variants have distinct GLSL, while all objects of each kind share a program.
  const customProgramCacheKey = useCallback(() => `sonar-surface-v1-${enemy}`, [enemy]);
  return <meshStandardMaterial {...props} onBeforeCompile={onBeforeCompile} customProgramCacheKey={customProgramCacheKey} />;
}
