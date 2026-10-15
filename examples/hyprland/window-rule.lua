-- Add to hyprland.lua. Don't add no_focus to the overlay: it makes the overlay ignore clicks.
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

hl.window_rule({
	-- Slack huddle panel (slack-patch 0005); kept above the drawing overlay so its
	-- "turn off drawing" button stays clickable
	name = "slack-huddle-panel",
	match = { title = "^Slack huddle$" },

	float = true,
	pin = true,
})

-- Clicking the Slack drawing overlay to draw focuses it, which raises it over the huddle panel
-- and hides the "turn off drawing" button. Raise the panel back, just after Hyprland's own raise.
hl.on("window.active", function()
	local active = hl.get_active_window()
	if not active or active.title ~= "Slack huddle drawing" then
		return
	end
	hl.timer(function()
		for _, w in ipairs(hl.get_windows()) do
			if w.title == "Slack huddle" then
				hl.dispatch(hl.dsp.window.alter_zorder({ window = "address:" .. w.address, mode = "top" }))
			end
		end
	end, { timeout = 50, type = "oneshot" })
end)
