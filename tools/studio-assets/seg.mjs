// Détourage (BiRefNet lite, MIT) + segmentation des vêtements (SegFormer clothes)
// node seg.mjs [ids…]  → alpha/<id>.png, cloth/<id>.png
import { AutoModel, AutoProcessor, pipeline, RawImage, env } from '@huggingface/transformers'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import sharp from 'sharp'

env.cacheDir = './models'
mkdirSync('alpha', { recursive: true })
mkdirSync('cloth', { recursive: true })

const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('orig').map((f) => f.replace('.jpg', ''))
const CLOTH = { tshirt: ['Upper-clothes', 'Dress'], polo: ['Upper-clothes', 'Dress'], sweat: ['Upper-clothes', 'Dress'], pull: ['Upper-clothes', 'Dress'], casquette: ['Hat'] }

const model = await AutoModel.from_pretrained('onnx-community/BiRefNet_lite-ONNX', { dtype: 'fp32' })
const processor = await AutoProcessor.from_pretrained('onnx-community/BiRefNet_lite-ONNX')
const segmenter = await pipeline('image-segmentation', 'Xenova/segformer_b2_clothes')

for (const id of ids) {
  const path = `orig/${id}.jpg`
  const image = await RawImage.read(path)
  if (!existsSync(`alpha/${id}.png`)) {
    const { pixel_values } = await processor(image)
    const { output_image } = await model({ input_image: pixel_values })
    const matte = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(image.width, image.height)
    await sharp(Buffer.from(matte.data), { raw: { width: matte.width, height: matte.height, channels: 1 } }).png().toFile(`alpha/${id}.png`)
  }
  const kind = id.replace(/^(homme|femme|p)-/, '')
  const labels = CLOTH[kind]
  if (labels && !existsSync(`cloth/${id}.png`)) {
    const parts = await segmenter(image)
    const found = parts.map((p) => p.label)
    const acc = new Uint8Array(image.width * image.height)
    for (const p of parts) {
      if (!labels.includes(p.label)) continue
      const m = p.mask
      for (let i = 0; i < acc.length; i++) acc[i] = Math.max(acc[i], m.data[i])
    }
    await sharp(Buffer.from(acc), { raw: { width: image.width, height: image.height, channels: 1 } }).png().toFile(`cloth/${id}.png`)
    console.log(id, 'labels:', found.join(','))
  } else console.log(id, 'ok')
}
