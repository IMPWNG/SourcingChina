declare module "heic-convert" {
  type HeicFormat = "JPEG" | "PNG";
  type HeicOptions = {
    buffer: ArrayBuffer | ArrayBufferView;
    format: HeicFormat;
    quality?: number;
  };
  function convert(options: HeicOptions): Promise<ArrayBuffer>;
  namespace convert {
    function all(options: HeicOptions): Promise<Array<{ convert: () => Promise<ArrayBuffer> }>>;
  }
  export default convert;
}
