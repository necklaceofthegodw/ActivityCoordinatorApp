const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.85

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  let { width, height } = bitmap
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_DIMENSION) / width)
      width = MAX_DIMENSION
    } else {
      width = Math.round((width * MAX_DIMENSION) / height)
      height = MAX_DIMENSION
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return }
        resolve(blob)
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
