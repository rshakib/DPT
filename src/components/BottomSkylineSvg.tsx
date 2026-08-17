import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface BottomSkylineSvgProps {
  color: string;
}

export function BottomSkylineSvg({ color }: BottomSkylineSvgProps) {
  // We use color with transparency for buildings and ground waves
  const lowOpacityColor = `${color}14`; // ~8% opacity
  const midOpacityColor = `${color}2B`; // ~17% opacity
  const highOpacityColor = `${color}5C`; // ~36% opacity

  return (
    <View style={styles.container}>
      <Svg width={width} height={120} viewBox={`0 0 ${width} 120`} fill="none">
        {/* Clouds */}
        <Rect x={width * 0.1} y={35} width={36} height={10} rx={5} fill="#ECE9FC" opacity={0.4} />
        <Rect x={width * 0.8} y={25} width={28} height={8} rx={4} fill="#ECE9FC" opacity={0.4} />

        {/* City Skyline Buildings */}
        <Rect x={width * 0.05} y={80} width={14} height={40} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.10} y={65} width={18} height={55} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.16} y={75} width={16} height={45} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.22} y={55} width={20} height={65} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.28} y={80} width={14} height={40} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.33} y={70} width={16} height={50} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.38} y={50} width={22} height={70} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.45} y={75} width={16} height={45} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.51} y={60} width={18} height={60} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.57} y={70} width={15} height={50} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.62} y={85} width={12} height={35} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.67} y={55} width={20} height={65} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.73} y={75} width={15} height={45} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.78} y={60} width={18} height={60} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.84} y={50} width={22} height={70} rx={2} fill={lowOpacityColor} />
        <Rect x={width * 0.91} y={70} width={16} height={50} rx={2} fill={lowOpacityColor} />

        {/* Curved Ground Waves */}
        <Path
          d={`M0 95 Q ${width * 0.25} 85, ${width * 0.5} 100 T ${width} 95 L ${width} 120 L 0 120 Z`}
          fill={midOpacityColor}
        />
        <Path
          d={`M0 104 Q ${width * 0.3} 95, ${width * 0.6} 110 T ${width} 105 L ${width} 120 L 0 120 Z`}
          fill={highOpacityColor}
        />

        {/* Dotted Flight Path */}
        <Path
          d={`M${width * 0.1} 105 C ${width * 0.2} 80, ${width * 0.4} 60, ${width * 0.7} 85 C ${width * 0.77} 90, ${width * 0.85} 80, ${width * 0.9} 65`}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="none"
        />

        {/* Paper Airplane at the end of path */}
        <Path
          d={`M${width * 0.89} 66 L ${width * 0.92} 55 L ${width * 0.93} 69 L ${width * 0.91} 67 Z`}
          fill={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
});
