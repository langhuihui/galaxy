varying vec3 vColor;
varying float vDistance;

void main() {
    // 计算到粒子中心的距离
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float strength = 0.05 / distanceToCenter - 0.1;
    
    // 根据距离调整亮度（中心更亮，边缘更暗）
    float distanceBrightness = 1.0 - (vDistance / 5.0) * 0.3;
    
    // 添加光晕效果
    float glow = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
    strength += glow * 0.3;
    
    // 最终颜色
    vec3 finalColor = vColor * strength * distanceBrightness;
    
    // 根据恒星类型调整颜色（模拟不同年龄的恒星）
    // 中心区域：蓝白色（年轻恒星）
    // 边缘区域：黄色到红色（老年恒星）
    float ageFactor = vDistance / 5.0;
    vec3 youngStarColor = vec3(0.8, 0.9, 1.0); // 蓝白色
    vec3 oldStarColor = vec3(1.0, 0.8, 0.6);   // 黄色
    vec3 starColor = mix(youngStarColor, oldStarColor, ageFactor);
    
    finalColor = mix(finalColor, finalColor * starColor, 0.3);
    
    gl_FragColor = vec4(finalColor, strength);
}
