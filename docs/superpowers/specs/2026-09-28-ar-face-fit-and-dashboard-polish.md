# AR Face Fit and Dashboard Polish Spec

## Goal

Make every bundled AR skin follow the relevant face geometry instead of sharing one generic face-center anchor, expose challenge presets for every five-day step from 5 through 30 days, and separate the attendance board from the primary brushing action on mobile.

## Requirements

- Face decorations use detected face width and height.
- Glasses use the eye midpoint and face width.
- Headwear and crowns use the forehead position and face width.
- Every skin follows face rotation and remains compatible with portrait camera cover cropping.
- Uploaded skins retain the legacy face-center placement unless they gain explicit placement metadata later.
- Challenge presets are exactly 5, 10, 15, 20, 25, and 30 days; the manual numeric input remains available.
- Presets render as six columns when space allows and three columns by two rows on small screens.
- The student attendance board and today's brushing action have an explicit 18px visual gap.
- Existing behavior remains covered by unit tests, and mobile layout is visually verified before deployment.

