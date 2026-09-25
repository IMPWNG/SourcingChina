declare module "jpeg-js" {
  type JpegDecodeOptions = {
    useTArray?: boolean;
    formatAsRGBA?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
    tolerantDecoding?: boolean;
    colorTransform?: boolean;
  };

  type JpegImage = {
    width: number;
    height: number;
    data: Uint8Array | Buffer;
  };

  function decode(jpegData: Buffer | Uint8Array, opts?: JpegDecodeOptions): JpegImage;
  function encode(image: JpegImage, quality?: number): { data: Uint8Array; width: number; height: number };

  const jpeg: { decode: typeof decode; encode: typeof encode };
  export default jpeg;
}
