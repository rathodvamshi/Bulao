import type { ImagePickerAsset } from 'expo-image-picker';
import { uploadImage } from './uploadImage';
export async function uploadServicePhoto(photo: ImagePickerAsset): Promise<string> {
  return (await uploadImage(photo, 'service')).fullUrl;
}
