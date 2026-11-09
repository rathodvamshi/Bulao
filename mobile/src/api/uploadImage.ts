import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';
import { api } from './client';
import { fetchWithTimeout } from './network';

export type UploadedImage = {id:string;ownerId:string;thumbnailUrl:string;mediumUrl:string;fullUrl:string};
// All current/future user image pickers use this path. Do not save a device URI
// to a profile or service: return only after Cloudinary verification + D1 commit.
export async function uploadImage(photo:ImagePickerAsset,purpose:'profile'|'service'):Promise<UploadedImage> {
  const mimeType=photo.mimeType ?? 'image/jpeg';
  if(!['image/jpeg','image/png','image/webp'].includes(mimeType)) throw new Error('Choose a JPG, PNG or WebP image.');
  const blob=Platform.OS==='web'?await fetch(photo.uri).then(r=>r.blob()):undefined;
  const bytes=photo.fileSize ?? blob?.size;
  if(!bytes || bytes>5*1024*1024) throw new Error('Choose a photo smaller than 5 MB with a readable file size.');
  const signed=await api<{url:string;fields:Record<string,string>}>('/images/authorize',{mimeType,bytes});
  const body=new FormData();
  for(const [key,value] of Object.entries(signed.fields)) body.append(key,value);
  if(blob)body.append('file',blob,photo.fileName ?? 'photo.jpg');
  else body.append('file',{uri:photo.uri,name:photo.fileName ?? 'photo.jpg',type:mimeType} as unknown as Blob);
  const response=await fetchWithTimeout(signed.url,{method:'POST',body},60000);
  if(!response.ok) throw new Error('Photo upload failed. Please retry.');
  return api<UploadedImage>('/images/confirm',{assetId:signed.fields.public_id,purpose});
}
