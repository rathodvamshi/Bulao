import { afterEach, expect, it, vi } from 'vitest';
import { appAssets } from '../src/modules/images/assets';
import { images } from '../src/modules/images/routes';
import { CloudinaryStorage } from '../src/providers/storage/cloudinary';
import { ApiError } from '../src/middleware/errors';
import { imageDeliveryUrl } from '../../mobile/src/utils/imageDelivery';

it('uses smaller reusable delivery sizes without upscaling or changing avatar crops',()=>{
  const base='https://res.cloudinary.com/japfuiuz/image/upload/';
  expect(imageDeliveryUrl(base+'c_limit,w_1440,h_1440,q_auto,f_auto/v1/photo.png',280)).toBe(base+'c_limit,w_320,h_320,q_auto,f_auto/v1/photo.png');
  expect(imageDeliveryUrl(base+'c_limit,w_320,q_auto,f_auto/v1/photo.png',900)).toBe(base+'c_limit,w_320,q_auto,f_auto/v1/photo.png');
  const avatar=base+'c_fill,w_160,h_160,q_auto,f_auto/v1/photo.png';
  expect(imageDeliveryUrl(avatar,640)).toBe(avatar);
  const external='https://other.example/image.jpg';expect(imageDeliveryUrl(external,320)).toBe(external);
});

vi.mock('../src/modules/auth/session',()=>({
  now:()=>1000,rateLimit:vi.fn(),
  requireAuth:async(c:any,next:()=>Promise<void>)=>{
    if(!c.req.header('Authorization'))return c.json({success:false},401);
    c.set('userId','owner');await next();
  },
}));
afterEach(()=>vi.restoreAllMocks());
images.onError((e,c)=>c.json({success:false},e instanceof ApiError?e.status:500));
const asset={id:'bulao/owner/image',ownerId:'owner',thumbnailUrl:'https://example.test/thumb',mediumUrl:'https://example.test/medium',fullUrl:'https://example.test/full'};
function fixture(intent=true){
  const statements:any[]=[];
  const DB={prepare:vi.fn((sql:string)=>{
    const statement={sql,values:[] as unknown[],bind(...values:unknown[]){this.values=values;return this;},
      first:vi.fn().mockResolvedValue(intent?{asset_id:asset.id}:null),run:vi.fn().mockResolvedValue({success:true})};
    statements.push(statement);return statement;
  }),batch:vi.fn().mockResolvedValue([])};
  return {env:{DB,CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test',CLOUDINARY_UPLOAD_PRESET:'test'},statements};
}
const request=(purpose:string,env:any)=>images.request('/confirm',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({assetId:asset.id,purpose})},env);
it('public registry returns only curated artwork, not uploaded user assets',async()=>{
  const rows=[{id:'login-hero',url:'https://example.test/image'}];
  const prepare=vi.fn().mockReturnValue({all:vi.fn().mockResolvedValue({results:rows})});
  const response=await appAssets.request('/',{}, {DB:{prepare}});
  expect(response.status).toBe(200);
  expect((await response.json()).data.assets).toEqual(rows);
  expect(prepare.mock.calls[0][0]).toContain('FROM app_assets');
  expect(prepare.mock.calls[0][0]).not.toContain('uploaded_image_assets');
});
it('registers a verified profile image and updates the avatar atomically',async()=>{
  vi.spyOn(CloudinaryStorage.prototype,'verifyAsset').mockResolvedValue(asset);
  const {env}=fixture();const response=await request('profile',env);
  expect(response.status).toBe(200);
  const writes=env.DB.batch.mock.calls[0]![0] as any[];
  expect(writes).toHaveLength(2);
  expect(writes[0].sql).toContain('INSERT INTO uploaded_image_assets');
  expect(writes[0].values).toEqual([asset.id,'owner','profile',asset.thumbnailUrl,asset.mediumUrl,asset.fullUrl,1000]);
  expect(writes[1].sql).toContain('UPDATE users');
});
it('registers a service image without replacing the profile avatar',async()=>{
  vi.spyOn(CloudinaryStorage.prototype,'verifyAsset').mockResolvedValue(asset);
  const {env}=fixture();expect((await request('service',env)).status).toBe(200);
  expect(env.DB.batch.mock.calls[0]![0]).toHaveLength(1);
});
it('does not persist an unverified upload or another owners intent',async()=>{
  const verify=vi.spyOn(CloudinaryStorage.prototype,'verifyAsset').mockRejectedValue(new ApiError('INVALID_IMAGE',403));
  const {env}=fixture();expect((await request('service',env)).status).toBe(403);
  expect(env.DB.batch).not.toHaveBeenCalled();
  verify.mockClear();const missing=fixture(false);
  expect((await request('service',missing.env)).status).toBe(403);
  expect(verify).not.toHaveBeenCalled();expect(missing.env.DB.batch).not.toHaveBeenCalled();
});
