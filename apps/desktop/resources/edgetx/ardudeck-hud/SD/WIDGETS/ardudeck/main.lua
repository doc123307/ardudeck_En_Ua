-- ArduDeck HUD widget stub.
-- EdgeTX loads every /WIDGETS/*/main.lua at model select, so this file stays
-- tiny and defers everything to loadable.lua (loaded once, on create).
-- Target: EdgeTX 2.11+, color radios (developed on 480x320 / TX15).

local loaded = nil

local function getLoaded()
  if loaded == nil then
    local chunk = loadScript('/WIDGETS/ardudeck/loadable.lua', 'tcd')
    if chunk then loaded = chunk() end
  end
  return loaded
end

local options = {
  { 'Mute', SWITCH, 0 },
  { 'Demo', BOOL, 0 },
  { 'DaySw', SWITCH, 0 },
  -- 0 = swipe between pages; 1..8 pins this instance to one page (for
  -- users who prefer EdgeTX's own multi-screen switching)
  { 'Page', VALUE, 0, 0, 8 },
  -- assign a switch: each flip advances one layout page (gloves-friendly)
  { 'PageSw', SWITCH, 0 },
}

local function create(zone, opts)
  local lib = getLoaded()
  if lib then return lib.create(zone, opts) end
  return { zone = zone, options = opts, broken = true }
end

local function update(widget, opts)
  local lib = getLoaded()
  if lib then lib.update(widget, opts) end
end

local function refresh(widget, event, touchState)
  local lib = getLoaded()
  if lib then
    lib.refresh(widget, event, touchState)
  else
    lcd.drawText(6, 6, 'STOHID HUD: loadable.lua missing', SMLSIZE + COLOR_THEME_WARNING)
  end
end

local function background(widget)
  local lib = getLoaded()
  if lib then lib.background(widget) end
end

return {
  name = 'STOHID',
  options = options,
  create = create,
  update = update,
  refresh = refresh,
  background = background,
  useLvgl = false,
}
