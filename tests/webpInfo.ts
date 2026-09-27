/** Canvas size and alpha flag of an extended (VP8X) WebP, the container PIL writes for RGBA. */
export function webpInfo(file: Buffer) {
  if (file.subarray(0, 4).toString('ascii') !== 'RIFF' || file.subarray(8, 12).toString('ascii') !== 'WEBP')
    throw new Error('not a WebP file');
  if (file.subarray(12, 16).toString('ascii') !== 'VP8X') throw new Error('expected an extended WebP with alpha');
  return {
    alpha: (file[20] & 0x10) !== 0,
    width: 1 + file.readUIntLE(24, 3),
    height: 1 + file.readUIntLE(27, 3),
  };
}
