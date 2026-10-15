shader_type canvas_item;
// 暗角（vignette）：四边径向压暗聚焦视线 —— 参照系配方之一，成本一行后处理。
// strength 0 = 关闭；0.25-0.4 是休闲游戏舒适区（模板默认 0.32）。
uniform float strength : hint_range(0.0, 1.0) = 0.32;

void fragment() {
	float d = distance(UV, vec2(0.5));
	float v = smoothstep(0.45, 0.85, d) * strength;
	COLOR = vec4(0.0, 0.0, 0.0, v);
}
