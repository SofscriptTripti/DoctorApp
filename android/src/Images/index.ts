// android/src/Images/index.ts
// Centralized imports/exports for image assets in this folder.
// IMPORTANT: filenames must exactly match (including capitalization).

import Eighth from './Eighth.jpeg';
import Eleventh from './Eleventh.jpeg';
import fifth from './fifth.jpeg';
import first from './first.jpeg';
import forth from './forth.jpeg';
import ninth from './ninth.jpeg';
import second from './second.jpeg';
import seventh from './seventh.jpeg';
import sixtg from './sixtg.jpeg'; // verify actual filename: "sixtg.jpeg" or "sixth.jpeg"
import Tenth from './Tenth.jpeg';
import Third from './Third.jpeg';
import Thirteen from './Thirteen.jpeg'; // verify capitalization ("Thirteen.jpeg")
import twelve from './twelve.jpeg';

const Images = {
  Eighth,
  Eleventh,
  fifth,
  first,
  forth,
  ninth,
  second,
  seventh,
  sixtg,
  Tenth,
  Third,
  Thirteen,
  twelve,
} as const;

type ImageKey = keyof typeof Images;
type ImageSource = typeof Images[ImageKey];

/**
 * imageList: useful for galleries
 */
const imageList: { name: ImageKey; source: ImageSource }[] = Object.keys(Images).map(
  (k) => ({ name: k as ImageKey, source: Images[k as ImageKey] })
);

/**
 * Safe getter
 */
function getImageByName(name: ImageKey): ImageSource {
  return Images[name];
}

export default Images;
export { Images as ImagesMap, imageList, getImageByName };    export type { ImageKey, ImageSource };

