import Svg, { Circle, Path } from "react-native-svg";
import { C, isDark } from "../theme";

/** Paisagem discreta (colinas e sol) em tons de cinzento, por trás da saudação do início. */
export function HeroArt({ width, height }: { width: number; height: number }) {
  const w = width;
  const h = height;
  const [a, b, c] = isDark ? ["#1c1c1f", "#232326", "#2b2b2f"] : ["#e6e5df", "#dcdbd4", "#cfcec6"];
  return (
    <Svg width={w} height={h} style={{ position: "absolute", top: 0, left: 0 }}>
      <Circle cx={w * 0.8} cy={h * 0.42} r={h * 0.16} fill={isDark ? "#2f2f33" : "#ffffff"} opacity={0.9} />
      <Path d={`M0 ${h * 0.62} C ${w * 0.2} ${h * 0.45}, ${w * 0.38} ${h * 0.5}, ${w * 0.55} ${h * 0.6} S ${w * 0.85} ${h * 0.48}, ${w} ${h * 0.55} L ${w} ${h} L 0 ${h} Z`} fill={a} />
      <Path d={`M0 ${h * 0.74} C ${w * 0.25} ${h * 0.62}, ${w * 0.45} ${h * 0.7}, ${w * 0.62} ${h * 0.76} S ${w * 0.9} ${h * 0.66}, ${w} ${h * 0.7} L ${w} ${h} L 0 ${h} Z`} fill={b} />
      <Path d={`M0 ${h * 0.88} C ${w * 0.3} ${h * 0.8}, ${w * 0.6} ${h * 0.9}, ${w} ${h * 0.84} L ${w} ${h} L 0 ${h} Z`} fill={c} />
      <Path d={`M0 ${h - 1} L ${w} ${h - 1} L ${w} ${h} L 0 ${h} Z`} fill={C.canvas} />
    </Svg>
  );
}
