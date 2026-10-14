-- Add to hyprland.lua. Don't add no_focus: it makes the overlay ignore clicks.
hl.window_rule({
	name = "slack-huddle-drawing",
	match = { title = "^Slack huddle drawing$" },

	float = true,
	pin = true,
	no_blur = true,
	no_initial_focus = true,
	no_follow_mouse = true,
	no_shadow = true,
})
