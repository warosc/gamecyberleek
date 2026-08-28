# Fase B — entrega del rig visual

El runtime ya contiene el contrato y el validador del rig. Para activar el renderer por capas,
entrega un paquete con esta estructura:

```text
public/assets/character/leek/rig/
  manifest.json
  layers/
    head.png
    hair-leaves.png
    glasses.png
    torso.png
    arm-left-upper.png
    arm-left-fore.png
    arm-right-upper.png
    arm-right-fore.png
    hand-left.png
    hand-right.png
    thigh-left.png
    thigh-right.png
    leg-left.png
    leg-right.png
    boot-left.png
    boot-right.png
  animations/
    idle.json
    walk.json
    attack.json
    dash.json
    hurt.json
    death.json
```

Cada PNG debe ser RGBA transparente, usar exactamente el mismo ancho/alto y conservar el mismo
pivote del personaje. No se deben recortar individualmente las piezas ni escalar hojas compuestas.
Los JSON de animación deben referenciar únicamente frames existentes y no repetir frames para
simular movimiento.

El archivo `manifest.json` debe cumplir el contrato `PlayerRigAssetManifest` de
`src/game/entities/player/PlayerRigManifest.ts`. Antes de activarlo se ejecutará
`validatePlayerRig()` y se comprobará que todas las texturas cargan sin errores.

Las hojas actuales (`rig-parts-reference.png` y `actions-reference.png`) permanecen como
referencias visuales y no deben copiarse como capas runtime.
