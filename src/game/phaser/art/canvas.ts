// The 2D context every generated texture is drawn with.
//
// A texture keeps its source canvas, and Phaser uploads that canvas again when the WebGL context
// comes back after a loss (a GPU reset, a driver update, waking from sleep). A GPU-backed canvas
// is cleared in the same reset, so every restored texture came back blank: invisible mobs,
// tiles and effects. willReadFrequently keeps the canvas in main memory, where its pixels survive,
// and it takes no GPU memory next to the texture. It must be the first getContext call on the
// canvas, because later calls return the same context and ignore their options.
export const ART_CONTEXT: CanvasRenderingContext2DSettings = { willReadFrequently: true }

export function artContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', ART_CONTEXT)
}
