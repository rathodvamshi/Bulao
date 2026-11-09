import { Image, type ImageProps } from 'expo-image';
import { PixelRatio, StyleSheet, type ImageResizeMode } from 'react-native';
import { useAppAsset } from '../api/assets';
import { imageDeliveryUrl } from '../utils/imageDelivery';

type Props = ImageProps & {assetId?:string;resizeMode?:ImageResizeMode;maxWidth?:number};
// Shared defaults for every screen. Screen artwork uses assetId; uploaded user
// images use the verified URL returned by /images/confirm. No local bitmap imports.
export function AppImage({assetId,source,resizeMode,contentFit,priority='normal',maxWidth,...props}:Props) {
  const asset=useAppAsset(assetId);
  const width=StyleSheet.flatten(props.style)?.width;
  const target=maxWidth ?? (typeof width==='number'?width*PixelRatio.get():priority==='high'?1440:640);
  const resolved=assetId ? (asset?{uri:asset.url}:(source??null)) : source;
  const optimized=resolved && typeof resolved==='object' && !Array.isArray(resolved) && 'uri' in resolved && typeof resolved.uri==='string'
    ? {...resolved,uri:imageDeliveryUrl(resolved.uri,target)} : resolved;
  const fit=contentFit ?? (resizeMode==='stretch'?'fill':resizeMode==='center'?'none':resizeMode==='repeat'?'cover':resizeMode) ?? 'cover';
  return <Image {...props} source={optimized}
    contentFit={fit} priority={priority} cachePolicy="memory-disk" transition={120} />;
}
