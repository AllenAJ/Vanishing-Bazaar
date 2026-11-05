// Shrinks a phone photo to a small square JPEG that fits comfortably in one Arkiv entity.
const MAX_BYTES = 24 * 1024
const SIZE = 320

export async function photoToThumb(file) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  canvas
    .getContext("2d")
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close?.()

  for (let quality = 0.72; quality >= 0.3; quality -= 0.1) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality))
    if (blob && blob.size <= MAX_BYTES) {
      return { bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) }
    }
  }
  throw new Error("That photo is too detailed to shrink. Try another one.")
}
