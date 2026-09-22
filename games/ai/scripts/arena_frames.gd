class_name ArenaFrames
extends RefCounted
## 行动段多帧动画帧集构建器：把人设卡声明的帧路径数组装进 SpriteFrames。
##
## 依赖方向（基线 §八）：调用方（信物/危机）传入「来自人设卡 art 字段」的路径数组，
## 本类不认识任何角色、不写任何贴图名 —— 换人设卡零代码改动。
## 帧路径缺失 / 资源加载失败时返回 null，调用方回落到原有单帧贴图路径。

## 构建循环动画帧集；paths 内不可读的路径自动跳过，全部失败返回 null。
static func build(paths: Array, anim: StringName, fps: float) -> SpriteFrames:
	var frames := SpriteFrames.new()
	var loaded := 0
	for path: Variant in paths:
		var texture: Texture2D = load(String(path))
		if texture == null:
			continue
		if not frames.has_animation(anim):
			frames.add_animation(anim)
		frames.add_frame(anim, texture)
		loaded += 1
	if loaded == 0:
		return null
	frames.set_animation_speed(anim, maxf(fps, 1.0))
	frames.set_animation_loop(anim, true)
	return frames
