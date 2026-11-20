# Street Aware interface

Street Aware opens on the outline of Bulgaria at national scale. The user can read concentrations, zoom into a group, and open a crash. The list provides the same records and details through ordinary HTML controls.

## Basemaps

Streets sets the white OpenStreetMap vector map against charcoal. Roads, buildings, water, and labels use gray values. Terrain uses a white surround and the light wordmark. It shows elevation shading over the aerial mosaic to make the mountain ranges readable.

The Bulgaria polygon clips the basemaps. Crash symbols sit above that mask so counts near the border can be read and selected. Their underlying records have passed the same country check. The camera and detail pane persist across basemap and language changes.

## Controls and data

Use Segoe UI or the system sans-serif. Put the supplied wordmark, map switches, and language action in the toolbar. Keep coverage beside the title. Offset the legend and zoom controls to the lower corners. Use a side panel for results and crash details on desktop and a bottom sheet on phones.

Use translucent red circles for hotspot counts and neutral circles for groups in Crashes. Blue, two-tone, red with a diamond, and gray with a dash distinguish the four severity classes. Labels repeat the meaning in text. Honor reduced motion for camera and drawer transitions, and restore focus when the detail pane closes.
