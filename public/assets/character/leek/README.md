# LEEK OPS character assets

Selected assets were copied from `reference/personaje_animacion_separado.zip`; the source ZIP remains unchanged.

`placeholder-front-reference.png` is used as a uniformly scaled in-game full-body placeholder. It is not treated as an animation rig. `rig-parts-reference.png` and `actions-reference.png` are visual references only; they are not fake animation frames. `avatar.png` is used in the HUD. `hero-clean-v2.png` is a cleaned, transparent, versioned menu illustration; it does not replace the directional gameplay poses.

`turnaround-profile.png` was refreshed from the improved profile source and is suitable for the current directional placeholder rendering. The revised primary and three-quarter images remain reference-only because they still contain visible off-silhouette color/shadow artifacts; they should not replace runtime art until they receive a clean transparent export.

Replace the placeholder with professionally separated rig assets without changing the Player controls or gameplay API. The exact layer/state contract is defined in `src/game/entities/player/PlayerRigManifest.ts`.

The supplied `rig-parts-reference.png` is a transparent reference sheet, but it combines multiple
variants in one atlas and is not safe to bind as runtime layers. The supplied `actions-reference.png`
is likewise a composite action sheet. Both remain visual references until each layer is exported as
an individually aligned transparent PNG (same canvas size, pivot, and naming as the manifest).

Never overwrite the original reference ZIP. Copy only production-ready assets from it into this directory.
