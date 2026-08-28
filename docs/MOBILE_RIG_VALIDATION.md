# Validación móvil del rig — Fase B

Esta prueba debe ejecutarse en un teléfono físico, no solo en emulación de escritorio.

## Procedimiento

1. Abrir la URL de producción en orientación horizontal.
2. Ejecutar una partida durante al menos 120 segundos.
3. Repetir una segunda partida después de morir y pulsar `RETRY SECTOR`.
4. Durante cada partida activar movimiento, disparo, dash y las tres habilidades.
5. Revisar la consola remota del navegador y confirmar cero errores, promesas rechazadas o
   pérdidas de contexto WebGL.

## Criterios de aceptación

- FPS sostenidos >= 45 en un dispositivo de entrada.
- Sin congelaciones superiores a 250 ms.
- Sin crecimiento continuo de memoria entre la primera y segunda partida.
- Las 16 capas del rig cargan sin 404 y conservan el mismo pivote.
- El fallback no debe activarse cuando todas las texturas están presentes.
- El gesto de rotación o pérdida de foco no deja movimiento ni disparo atascados.

Registrar modelo, sistema operativo, navegador, FPS mínimo/promedio y memoria aproximada en la
sección de medición de `docs/TECHNICAL_AUDIT.md` antes de cerrar esta tarea.
