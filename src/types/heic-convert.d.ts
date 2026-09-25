declare module "heic-convert" {
  type HeicFormat = "JPEG" | "PNG";
  function convert(options: {
    buffer: ArrayBuffer | ArrayBufferView;
    format: HeicFormat;
    quality?: number;
  }): Promise<ArrayBuffer>;
  export default convert;
}
