// Resize only our Cloudinary c_limit URLs. Preserve signatures, third-party
// photos, avatar crops and version IDs. Fixed buckets keep CDN cache reuse high.
export function imageDeliveryUrl(url:string,targetWidth:number):string {
  if(!url.startsWith('https://res.cloudinary.com/japfuiuz/image/upload/')) return url;
  const bucket=[160,320,640,900,1122,1440].find(n=>n>=targetWidth) ?? 1440;
  return url.replace(/\/c_limit,w_(\d+)(?:,h_(\d+))?,q_auto,f_auto\//,(_match,width,height)=>{
    const limited=Math.min(Number(width),bucket);
    const h=height?`,h_${Math.min(Number(height),bucket)}`:'';
    return `/c_limit,w_${limited}${h},q_auto,f_auto/`;
  });
}
